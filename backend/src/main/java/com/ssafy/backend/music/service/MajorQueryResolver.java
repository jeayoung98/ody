package com.ssafy.backend.music.service;

/**
 * 레벨 → 현재 조회 PC 축 쌍 변환 (FR-003). level n 은 PC(2n-1)·PC(2n) 에 대응한다.
 * 순수 함수 — DB·HTTP 에 의존하지 않는다.
 *
 * 지원 레벨 상한·생략·좌표 유효성은 B1 미정이므로 여기서 정하지 않는다.
 * 아래 경계 검사는 제품 정책이 아니라 pc1~pc16 이라는 데이터 차원의 사실이다.
 */
public final class MajorQueryResolver {

	private MajorQueryResolver() {
	}

	/**
	 * 현재 조회 축 번호와 그 축의 중심좌표. level=1 최상위 진입에서는 중심이 null 일 수 있다(FR-004).
	 */
	public record Axes(int axisX, int axisY, Double centerX, Double centerY) {
	}

	/**
	 * @param center pc1~pc16 중심좌표. 전달되지 않은 축은 null.
	 */
	public static Axes resolve(int level, Double[] center) {
		int axisX = 2 * level - 1;
		int axisY = 2 * level;
		if (axisX < 1 || axisY > center.length) {
			throw new IllegalArgumentException(
					"level %d 는 pc1~pc%d 축 범위를 벗어난다 (공개 지원 레벨 상한은 B1 미정)".formatted(level, center.length));
		}
		return new Axes(axisX, axisY, center[axisX - 1], center[axisY - 1]);
	}
}
