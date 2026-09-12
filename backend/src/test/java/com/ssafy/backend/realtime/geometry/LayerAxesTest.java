package com.ssafy.backend.realtime.geometry;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * LayerAxes 순수 계산 검증 — 레이어 l → PC(2l-1, 2l) (spec FR-031).
 */
class LayerAxesTest {

	private static final int MAX_LAYER = 8; // PC16 → 8레이어

	@Test
	@DisplayName("레이어 → 축 쌍: 1→[1,2], 3→[5,6], 8→[15,16]")
	void axesArithmetic() {
		assertArrayEquals(new int[] {1, 2}, LayerAxes.axesOf(1, MAX_LAYER).orElseThrow());
		assertArrayEquals(new int[] {5, 6}, LayerAxes.axesOf(3, MAX_LAYER).orElseThrow());
		assertArrayEquals(new int[] {15, 16}, LayerAxes.axesOf(8, MAX_LAYER).orElseThrow());
	}

	@Test
	@DisplayName("범위 밖 레이어(0, 상한 초과)는 empty")
	void axesOutOfRange() {
		assertTrue(LayerAxes.axesOf(0, MAX_LAYER).isEmpty());
		assertTrue(LayerAxes.axesOf(9, MAX_LAYER).isEmpty());
		assertTrue(LayerAxes.axesOf(-1, MAX_LAYER).isEmpty());
	}

	@Test
	@DisplayName("maxLayer 로 상한이 바뀐다")
	void axesRespectsMaxLayer() {
		Optional<int[]> l4 = LayerAxes.axesOf(4, 4);
		assertArrayEquals(new int[] {7, 8}, l4.orElseThrow());
		assertTrue(LayerAxes.axesOf(5, 4).isEmpty()); // maxLayer=4 이면 5는 없음
	}
}
