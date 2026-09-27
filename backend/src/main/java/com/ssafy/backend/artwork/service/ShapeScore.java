package com.ssafy.backend.artwork.service;

import java.util.List;

/**
 * 두 점열의 모양 일치도 (S15P21A405-598). 이동·회전·균일 배율에 불변이고, 좌우 반전은 다른 모양으로 본다.
 *
 * <p>2D Procrustes 거리다. 각 점열을 무게중심으로 옮기고 크기(프로베니우스 노름)를 1 로 맞춘 뒤, 점을 복소수로 보고
 * {@code a = Σ conj(u_i)·v_i} 를 구한다. 최적 회전 후 잔차는 {@code d = √(2 − 2|a|)} (0 = 같은 모양, 최대 √2).
 * 복소수 곱은 회전만 표현하므로 반사는 자동으로 빠진다. 점 i 는 점 i 와만 비교한다 — 순서가 곧 대응이다.
 *
 * <p>닫힌 식이라 반복·난수가 없어 같은 입력이면 같은 점수다. Spring·DB 에 의존하지 않는 순수 계산이다.
 */
public final class ShapeScore {

	/** 품질 단계. 응답에는 이름 그대로 나간다. */
	public enum Quality { HIGH, MEDIUM, LOW }

	/**
	 * ponytail: 경계 90/70 은 d = 0.1 / 0.3 — 점이 그림 크기의 약 10% / 30% 만큼 흩어진 수준이다(specs/010 research R3).
	 * 운영 실측상 결과 대부분이 100 근처라 LOW 는 드물다. 조정이 필요하면 운영 로그 {@code [Artwork] 그림 매칭 score=} 분포로.
	 */
	static final int HIGH_MIN = 90;
	static final int MEDIUM_MIN = 70;

	/** 크기가 이보다 작으면 모양이 없다고 본다. 호출자가 먼저 막으므로 여기 오면 버그다. */
	private static final double NORM_EPS = 1e-12;

	private ShapeScore() {
	}

	/**
	 * @param drawn  기준 점열 (사용자 그림)
	 * @param result 비교할 점열 (결과 별자리). {@code drawn} 과 같은 길이·같은 순서
	 * @return 0~100
	 * @throws IllegalArgumentException 길이가 다르거나 2개 미만, 또는 한 점에 몰려 크기가 0 일 때
	 */
	public static int score(List<double[]> drawn, List<double[]> result) {
		if (drawn.size() != result.size() || drawn.size() < 2) {
			throw new IllegalArgumentException("점열 길이가 다르거나 2개 미만이다: %d vs %d"
					.formatted(drawn.size(), result.size()));
		}
		double[][] u = unit(drawn);
		double[][] v = unit(result);

		// conj(u)·v = (ux − i·uy)(vx + i·vy) = (ux·vx + uy·vy) + i(ux·vy − uy·vx)
		double re = 0;
		double im = 0;
		for (int i = 0; i < u.length; i++) {
			re += u[i][0] * v[i][0] + u[i][1] * v[i][1];
			im += u[i][0] * v[i][1] - u[i][1] * v[i][0];
		}
		double d = Math.sqrt(Math.max(0, 2 - 2 * Math.hypot(re, im)));
		return (int) Math.round(100 * Math.max(0, 1 - d));
	}

	public static Quality quality(int score) {
		if (score >= HIGH_MIN) {
			return Quality.HIGH;
		}
		return score >= MEDIUM_MIN ? Quality.MEDIUM : Quality.LOW;
	}

	/** 무게중심 이동 + 노름 1. 입력은 건드리지 않는다. */
	private static double[][] unit(List<double[]> points) {
		int n = points.size();
		double mx = 0;
		double my = 0;
		for (double[] p : points) {
			mx += p[0];
			my += p[1];
		}
		mx /= n;
		my /= n;

		double[][] out = new double[n][2];
		double norm = 0;
		for (int i = 0; i < n; i++) {
			out[i][0] = points.get(i)[0] - mx;
			out[i][1] = points.get(i)[1] - my;
			norm += out[i][0] * out[i][0] + out[i][1] * out[i][1];
		}
		norm = Math.sqrt(norm);
		if (norm < NORM_EPS) {
			throw new IllegalArgumentException("점이 한 곳에 몰려 모양이 없다");
		}
		for (double[] p : out) {
			p[0] /= norm;
			p[1] /= norm;
		}
		return out;
	}
}
