package com.ssafy.backend.music;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.journey.AxisFrame;

/**
 * 축 좌표계 단위 테스트 (T053 · T061 · T062). 합성 좌표만 쓴다 — 실 DB 불필요.
 *
 * <p>핸드오프 §4.1~§4.3 의 정의를 그대로 검증한다.
 */
class AxisFrameTests {

	/** 16차원 좌표. 앞 몇 축만 채우고 나머지는 0. */
	private static float[] v(double... head) {
		float[] x = new float[16];
		for (int i = 0; i < head.length; i++) {
			x[i] = (float) head[i];
		}
		return x;
	}

	// ------------------------------------------------------------ 진행도 · 축 이탈

	@Test
	void progress_isZeroAtStartAndOneAtEnd() {
		AxisFrame f = AxisFrame.of(v(0, 0), v(10, 0));

		assertThat(f.progress(v(0, 0))).isCloseTo(0.0, within(1e-6));
		assertThat(f.progress(v(10, 0))).isCloseTo(1.0, within(1e-6));
		assertThat(f.progress(v(5, 0))).isCloseTo(0.5, within(1e-6));
	}

	@Test
	void progress_isNegativeBehindStartAndOverOneBeyondEnd() {
		AxisFrame f = AxisFrame.of(v(0, 0), v(10, 0));

		// 후보 선별이 p<=0 · p>=1 을 버리는 근거 (핸드오프 §4.3-2)
		assertThat(f.progress(v(-3, 0))).isLessThan(0.0);
		assertThat(f.progress(v(13, 0))).isGreaterThan(1.0);
	}

	@Test
	void offAxis_isPerpendicularDistance() {
		AxisFrame f = AxisFrame.of(v(0, 0), v(10, 0));

		assertThat(f.offAxis(v(5, 3))).isCloseTo(3.0, within(1e-6));
		assertThat(f.offAxis(v(5, 0))).isCloseTo(0.0, within(1e-6));
	}

	/**
	 * 축 위의 곡은 r 이 정확히 0 이어야 한다.
	 *
	 * <p>참조 구현이 {@code ‖x−A‖² − proj²} 로 구했다가 큰 수의 차에서 자리수가 날아가
	 * 0 대신 0.011 이 나온 자리다. 좌표를 크게 잡아 그 조건을 재현한다.
	 */
	@Test
	void offAxis_isExactlyZeroOnAxis_largeCoordinates() {
		AxisFrame f = AxisFrame.of(v(1000, 1000), v(1100, 1100));

		assertThat(f.offAxis(v(1050, 1050))).isCloseTo(0.0, within(1e-3));
	}

	@Test
	void of_rejectsMismatchedDimensions() {
		assertThatThrownBy(() -> AxisFrame.of(new float[16], new float[8]))
				.isInstanceOf(IllegalArgumentException.class);
	}

	// ------------------------------------------------------------------ 층 지점

	/**
	 * 핵심 항등식: {@code ‖x − c_k‖² = L²·(p − t_k)² + r²}.
	 *
	 * <p>이것이 성립하므로 통로 스캔 대신 {@code c_k} 최근접 질의로 같은 후보를 얻는다(핸드오프 §4.3).
	 * 깨지면 층 후보가 조용히 달라진다.
	 */
	@Test
	void layerPoint_satisfiesCandidateIdentity() {
		AxisFrame f = AxisFrame.of(v(0, 0, 0), v(12, 0, 0));
		int n = 10;
		float[] x = v(4.0, 2.5, 1.5);

		double p = f.progress(x);
		double r = f.offAxis(x);
		double lsq = f.length() * f.length();

		for (int k = 1; k <= n; k++) {
			float[] ck = f.layerPoint(k, n);
			double t = (double) k / (n + 1);

			double actual = 0.0;
			for (int i = 0; i < x.length; i++) {
				double d = x[i] - ck[i];
				actual += d * d;
			}
			double expected = lsq * (p - t) * (p - t) + r * r;

			assertThat(actual).as("층 %d", k).isCloseTo(expected, within(1e-3));
		}
	}

	@Test
	void layerPoint_dividesAxisEvenly() {
		AxisFrame f = AxisFrame.of(v(0, 0), v(10, 0));

		// n=9 면 t_k = k/10 이라 층 지점이 1,2,...,9
		for (int k = 1; k <= 9; k++) {
			assertThat(f.layerPoint(k, 9)[0]).isCloseTo((float) k, within(1e-3f));
		}
	}

	// -------------------------------------------------------------- T061 역 수

	@Test
	void stationCount_isTenWhenNotFar() {
		assertThat(AxisFrame.of(v(0, 0), v(5, 0)).stationCount(10.7)).isEqualTo(10);
		// 경계: L == farDist 는 먼 여정이 아니다
		assertThat(AxisFrame.of(v(0, 0), v(10.7, 0)).stationCount(10.7)).isEqualTo(10);
	}

	@Test
	void stationCount_growsWithDistanceBeyondThreshold() {
		// L = 15.7 -> round(10 + 5.0) = 15
		assertThat(AxisFrame.of(v(0, 0), v(15.7, 0)).stationCount(10.7)).isEqualTo(15);
	}

	@Test
	void stationCount_clampsAtTwenty_neverRejectsFarPair() {
		// 아주 먼 쌍도 거절하지 않고 상한 20 으로 붙는다 (D3)
		assertThat(AxisFrame.of(v(0, 0), v(100, 0)).stationCount(10.7)).isEqualTo(20);
		assertThat(AxisFrame.of(v(0, 0), v(1000, 0)).stationCount(10.7)).isEqualTo(20);
	}

	@Test
	void far_flagsOnlyBeyondThreshold() {
		assertThat(AxisFrame.of(v(0, 0), v(10.7, 0)).far(10.7)).isFalse();
		assertThat(AxisFrame.of(v(0, 0), v(10.8, 0)).far(10.7)).isTrue();
	}

	// --------------------------------------------------------- T062 L == 0

	@Test
	void degenerate_whenDistinctSongsShareCoordinates() {
		AxisFrame f = AxisFrame.of(v(1, 2, 3), v(1, 2, 3));

		// 통로를 만들 수 없다 -> 호출자가 2곡 경로로 끊는다 (FR-012)
		assertThat(f.degenerate()).isTrue();
		assertThat(f.length()).isZero();
	}

	@Test
	void degenerate_doesNotThrowOnProgressOrOffAxis() {
		AxisFrame f = AxisFrame.of(v(1, 2), v(1, 2));

		assertThat(f.progress(v(9, 9))).isZero();
		assertThat(f.offAxis(v(1, 2))).isZero();
	}
}
