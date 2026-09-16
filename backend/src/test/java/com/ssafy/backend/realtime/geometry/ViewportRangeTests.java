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
	void layerOneUsesNoPreviousBounds() {
		ViewportRange viewport = new ViewportRange(1, -1, 1, -2, 2, List.of());

		assertDoesNotThrow(viewport::validate);
	}

	@Test
	void layerNeedsEveryPreviousBoundInOrder() {
		ViewportRange missing = new ViewportRange(3, -1, 1, -1, 1,
				List.of(new LayerBound(1, -2, 2, -2, 2)));
		ViewportRange wrongOrder = new ViewportRange(3, -1, 1, -1, 1,
				List.of(
						new LayerBound(2, -2, 2, -2, 2),
						new LayerBound(1, -3, 3, -3, 3)));

		assertThrows(IllegalArgumentException.class, missing::validate);
		assertThrows(IllegalArgumentException.class, wrongOrder::validate);
	}

	@Test
	void rejectsInvalidOrInfiniteRanges() {
		ViewportRange reversed = new ViewportRange(1, 2, 1, -1, 1, List.of());
		ViewportRange infinite = new ViewportRange(1, -1, Double.POSITIVE_INFINITY, -1, 1, List.of());

		assertThrows(IllegalArgumentException.class, reversed::validate);
		assertThrows(IllegalArgumentException.class, infinite::validate);
	}

	@Test
	void currentRectangleIncludesItsEdges() {
		ViewportRange viewport = new ViewportRange(1, -1, 1, -2, 2, List.of());

		assertTrue(viewport.contains(-1, -2));
		assertTrue(viewport.contains(1, 2));
		assertFalse(viewport.contains(1.01, 0));
	}

	@Test
	void checksEveryPreviousLayerAgainstPcCoordinates() {
		ViewportRange viewport = new ViewportRange(3, -1, 1, -1, 1,
				List.of(
						new LayerBound(1, 0, 10, 10, 20),
						new LayerBound(2, 20, 30, 30, 40)));

		assertTrue(viewport.satisfiesBounds(new double[] {5, 15, 25, 35, 0, 0}));
		assertFalse(viewport.satisfiesBounds(new double[] {5, 15, 31, 35, 0, 0}));
		assertFalse(viewport.satisfiesBounds(new double[] {5, 15}));
	}
}
