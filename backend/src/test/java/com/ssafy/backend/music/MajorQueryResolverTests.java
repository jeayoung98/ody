package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.service.MajorQueryResolver;

/**
 * A9/A10 (FR-003): level n → PC(2n-1)·PC(2n) 축 해석.
 */
class MajorQueryResolverTests {

	/** pc1~pc16 에 축 번호를 그대로 값으로 넣어 어느 축을 읽었는지 구분한다. */
	private static Double[] centerNumberedByAxis() {
		Double[] center = new Double[16];
		for (int i = 0; i < center.length; i++) {
			center[i] = (double) (i + 1);
		}
		return center;
	}

	@Test
	void level1_resolvesToPc1AndPc2() {
		MajorQueryResolver.Axes axes = MajorQueryResolver.resolve(1, centerNumberedByAxis());

		assertEquals(1, axes.axisX());
		assertEquals(2, axes.axisY());
		assertEquals(1.0, axes.centerX());
		assertEquals(2.0, axes.centerY());
	}

	@Test
	void level2_resolvesToPc3AndPc4_notPreviousStage() {
		MajorQueryResolver.Axes axes = MajorQueryResolver.resolve(2, centerNumberedByAxis());

		assertEquals(3, axes.axisX());
		assertEquals(4, axes.axisY());
		assertEquals(3.0, axes.centerX());
		assertEquals(4.0, axes.centerY());
		// 이전 단계(PC1–PC2) 중심으로 해석하지 않는다.
		assertNotEquals(1.0, axes.centerX());
		assertNotEquals(2.0, axes.centerY());
	}

	@Test
	void topLevel_allowsOmittedCenter() {
		MajorQueryResolver.Axes axes = MajorQueryResolver.resolve(1, new Double[16]);

		assertEquals(1, axes.axisX());
		assertNull(axes.centerX());
		assertNull(axes.centerY());
	}

	@Test
	void levelBeyondAvailableAxes_isRejected() {
		// pc16 이 마지막이므로 level 9 는 존재하지 않는 축을 요구한다. 공개 상한 정책(B1)과는 별개다.
		assertThrows(IllegalArgumentException.class, () -> MajorQueryResolver.resolve(9, new Double[16]));
	}
}
