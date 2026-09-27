package com.ssafy.backend.realtime.geometry;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.geometry.ViewportRange.LayerBound;

class ViewportRangeTests {

	@Test
	void layerZeroUsesNoPreviousBounds() {
		ViewportRange viewport = new ViewportRange(0, -1, 1, -2, 2, List.of());

		assertDoesNotThrow(viewport::validate);
	}

	@Test
	void layerNeedsEveryPreviousBoundInOrder() {
		ViewportRange missing = new ViewportRange(2, -1, 1, -1, 1,
				List.of(new LayerBound(0, -2, 2, -2, 2)));
		ViewportRange wrongOrder = new ViewportRange(2, -1, 1, -1, 1,
				List.of(
						new LayerBound(1, -2, 2, -2, 2),
						new LayerBound(0, -3, 3, -3, 3)));

		assertThrows(IllegalArgumentException.class, missing::validate);
		assertThrows(IllegalArgumentException.class, wrongOrder::validate);
	}

	@Test
	void rejectsInvalidOrInfiniteRanges() {
		ViewportRange reversed = new ViewportRange(0, 2, 1, -1, 1, List.of());
		ViewportRange infinite = new ViewportRange(0, -1, Double.POSITIVE_INFINITY, -1, 1, List.of());

		assertThrows(IllegalArgumentException.class, reversed::validate);
		assertThrows(IllegalArgumentException.class, infinite::validate);
	}

	@Test
	void currentRectangleIncludesItsEdges() {
		ViewportRange viewport = new ViewportRange(0, -1, 1, -2, 2, List.of());

		assertTrue(viewport.contains(-1, -2));
		assertTrue(viewport.contains(1, 2));
		assertFalse(viewport.contains(1.01, 0));
	}

	@Test
	void checksEveryPreviousLayerAgainstPcCoordinates() {
		// 레이어 0 = pc1·pc2, 레이어 1 = pc3·pc4 (0-based)
		ViewportRange viewport = new ViewportRange(2, -1, 1, -1, 1,
				List.of(
						new LayerBound(0, 0, 10, 10, 20),
						new LayerBound(1, 20, 30, 30, 40)));

		assertTrue(viewport.satisfiesBounds(new double[] {5, 15, 25, 35, 0, 0}));
		assertFalse(viewport.satisfiesBounds(new double[] {5, 15, 31, 35, 0, 0}));
		assertFalse(viewport.satisfiesBounds(new double[] {5, 15}));
	}
}
