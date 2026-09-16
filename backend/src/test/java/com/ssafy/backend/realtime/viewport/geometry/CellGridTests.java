package com.ssafy.backend.realtime.viewport.geometry;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.realtime.config.RealtimeProperties;
import com.ssafy.backend.realtime.geometry.CellGrid;
import com.ssafy.backend.realtime.geometry.CellGrid.Cell;
import com.ssafy.backend.realtime.geometry.CoordinateMapper;
import com.ssafy.backend.realtime.geometry.Viewport;

class CellGridTests {

	@Test
	void includesBothCellsWhenScreenTouchesBoundary() {
		CoordinateMapper mapper = mapper(4);
		Viewport viewport = new Viewport(1, 3, 4, 3, 4, List.of());

		Set<Cell> cells = CellGrid.findCellsInCurrentScreen(viewport, mapper);

		assertEquals(Set.of(
				new Cell(0, 0), new Cell(0, 1),
				new Cell(1, 0), new Cell(1, 1)), cells);
	}

	@Test
	void clampsScreenOutsideAxisRangeToEdgeCells() {
		CoordinateMapper mapper = mapper(4);
		Viewport viewport = new Viewport(1, -100, 100, -100, 100, List.of());

		Set<Cell> cells = CellGrid.findCellsInCurrentScreen(viewport, mapper);

		assertEquals(16, cells.size());
		assertTrue(cells.contains(new Cell(0, 0)));
		assertTrue(cells.contains(new Cell(3, 3)));
	}

	@Test
	void returnsOneCellForScreenInsideOneCell() {
		CoordinateMapper mapper = mapper(4);
		Viewport viewport = new Viewport(1, 1, 3, 1, 3, List.of());

		assertEquals(Set.of(new Cell(0, 0)), CellGrid.findCellsInCurrentScreen(viewport, mapper));
	}

	private CoordinateMapper mapper(int grid) {
		RealtimeProperties.Viewport viewport = new RealtimeProperties.Viewport(grid, 36, 64, 250, 5000);
		return new CoordinateMapper(new RealtimeProperties(
				new RealtimeProperties.Presence(15_000, 45_000, 10_000, 60_000),
				new RealtimeProperties.Nearby(10),
				viewport,
				List.of(
						new RealtimeProperties.AxisRange(1, 0, 16),
						new RealtimeProperties.AxisRange(2, 0, 16))));
	}
}
