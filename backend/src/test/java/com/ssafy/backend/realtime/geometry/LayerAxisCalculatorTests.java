package com.ssafy.backend.realtime.geometry;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * LayerAxisCalculator 순수 계산 검증 — 레이어 l → PC(2l-1, 2l) (spec FR-031).
 */
class LayerAxisCalculatorTests {

	private static final int MAX_LAYER = 8; // PC16 → 8레이어

	@Test
	@DisplayName("레이어(0-based) → 축 쌍: 0→[1,2], 2→[5,6], 7→[15,16]")
	void axesArithmetic() {
		assertArrayEquals(new int[] {1, 2}, LayerAxisCalculator.findAxes(0, MAX_LAYER).orElseThrow());
		assertArrayEquals(new int[] {5, 6}, LayerAxisCalculator.findAxes(2, MAX_LAYER).orElseThrow());
		assertArrayEquals(new int[] {15, 16}, LayerAxisCalculator.findAxes(7, MAX_LAYER).orElseThrow());
	}

	@Test
	@DisplayName("범위 밖 레이어(음수, 레이어 수 이상)는 empty")
	void axesOutOfRange() {
		assertTrue(LayerAxisCalculator.findAxes(8, MAX_LAYER).isEmpty()); // 0~7 만 유효
		assertTrue(LayerAxisCalculator.findAxes(9, MAX_LAYER).isEmpty());
		assertTrue(LayerAxisCalculator.findAxes(-1, MAX_LAYER).isEmpty());
	}

	@Test
	@DisplayName("maxLayer 로 상한이 바뀐다")
	void axesRespectsMaxLayer() {
		Optional<int[]> l3 = LayerAxisCalculator.findAxes(3, 4);
		assertArrayEquals(new int[] {7, 8}, l3.orElseThrow());
		assertTrue(LayerAxisCalculator.findAxes(4, 4).isEmpty()); // maxLayer=4 이면 유효 번호는 0~3
	}
}
