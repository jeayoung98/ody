package com.ssafy.backend.realtime.viewport.geometry;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.realtime.geometry.Viewport;
import com.ssafy.backend.realtime.geometry.Viewport.LayerBound;

class ViewportTests {

	@Test
	void layerOneUsesNoPreviousBounds() {
		Viewport viewport = new Viewport(1, -1, 1, -2, 2, List.of());

		assertDoesNotThrow(viewport::validate);
	}

	@Test
	void layerNeedsEveryPreviousBoundInOrder() {
		Viewport missing = new Viewport(3, -1, 1, -1, 1,
				List.of(new LayerBound(1, -2, 2, -2, 2)));
		Viewport wrongOrder = new Viewport(3, -1, 1, -1, 1,
				List.of(
						new LayerBound(2, -2, 2, -2, 2),
						new LayerBound(1, -3, 3, -3, 3)));

		assertThrows(IllegalArgumentException.class, missing::validate);
		assertThrows(IllegalArgumentException.class, wrongOrder::validate);
	}

	@Test
	void rejectsInvalidOrInfiniteRanges() {
		Viewport reversed = new Viewport(1, 2, 1, -1, 1, List.of());
		Viewport infinite = new Viewport(1, -1, Double.POSITIVE_INFINITY, -1, 1, List.of());

		assertThrows(IllegalArgumentException.class, reversed::validate);
		assertThrows(IllegalArgumentException.class, infinite::validate);
	}

	@Test
	void currentRectangleIncludesItsEdges() {
		Viewport viewport = new Viewport(1, -1, 1, -2, 2, List.of());

		assertTrue(viewport.contains(-1, -2));
		assertTrue(viewport.contains(1, 2));
		assertFalse(viewport.contains(1.01, 0));
	}

	@Test
	void checksEveryPreviousLayerAgainstPcCoordinates() {
		Viewport viewport = new Viewport(3, -1, 1, -1, 1,
				List.of(
						new LayerBound(1, 0, 10, 10, 20),
						new LayerBound(2, 20, 30, 30, 40)));

		assertTrue(viewport.satisfiesBounds(new double[] {5, 15, 25, 35, 0, 0}));
		assertFalse(viewport.satisfiesBounds(new double[] {5, 15, 31, 35, 0, 0}));
		assertFalse(viewport.satisfiesBounds(new double[] {5, 15}));
	}
}
