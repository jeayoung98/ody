package com.ssafy.backend.realtime.dto.presence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.dto.presence.ViewportRequest.LayerBound;

class ViewportRequestTests {

	@Test
	void convertsPreviousLayerBoundsWithoutChangingValues() {
		ViewportRequest request = new ViewportRequest(
				7L, 2, -1.0, 1.0, -2.0, 2.0,
				List.of(new LayerBound(1, -3.0, 3.0, -4.0, 4.0)));

		ViewportRange viewport = request.toViewport();

		assertEquals(2, viewport.layer());
		assertEquals(-3.0, viewport.ancestorBounds().get(0).minX());
		assertEquals(4.0, viewport.ancestorBounds().get(0).maxY());
	}

	@Test
	void rejectsBoundsThatDoNotMatchLayer() {
		ViewportRequest request = new ViewportRequest(
				1L, 2, -1.0, 1.0, -1.0, 1.0, List.of());

		assertThrows(IllegalArgumentException.class, request::toViewport);
	}
}
