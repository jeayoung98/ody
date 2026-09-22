package com.ssafy.backend.realtime.geometry;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.realtime.config.RealtimeProperties;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.CombinedCells;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.ViewportRange;

class ViewportCellCalculatorTests {

	@Test
	void includesBothCellsWhenScreenTouchesBoundary() {
		MusicPositionCalculator mapper = mapper(4);
		ViewportRange viewport = new ViewportRange(0, 3, 4, 3, 4, List.of());

		Set<Cell> cells = ViewportCellCalculator.findCellsInCurrentScreen(viewport, mapper);

		assertEquals(Set.of(
				new Cell(0, 0), new Cell(0, 1),
				new Cell(1, 0), new Cell(1, 1)), cells);
	}

	@Test
	void clampsScreenOutsideAxisRangeToEdgeCells() {
		MusicPositionCalculator mapper = mapper(4);
		ViewportRange viewport = new ViewportRange(0, -100, 100, -100, 100, List.of());

		Set<Cell> cells = ViewportCellCalculator.findCellsInCurrentScreen(viewport, mapper);

		assertEquals(16, cells.size());
		assertTrue(cells.contains(new Cell(0, 0)));
		assertTrue(cells.contains(new Cell(3, 3)));
	}

	@Test
	void returnsOneCellForScreenInsideOneCell() {
		MusicPositionCalculator mapper = mapper(4);
		ViewportRange viewport = new ViewportRange(0, 1, 3, 1, 3, List.of());

		assertEquals(Set.of(new Cell(0, 0)), ViewportCellCalculator.findCellsInCurrentScreen(viewport, mapper));
	}

	@Test
	void combinesSixteenBySixteenIntoEightByEight() {
		Map<Cell, Integer> counts = counts(100);

		CombinedCells result = ViewportCellCalculator.combineNearbyCellsForDisplay(counts, 64, 16);

		assertEquals(8, result.cellsPerRow());
		assertTrue(result.userCountByCell().size() <= 64);
		assertEquals(100, total(result));
	}

	@Test
	void combinesAgainIntoFourByFourWhenNeeded() {
		Map<Cell, Integer> counts = counts(200);

		CombinedCells result = ViewportCellCalculator.combineNearbyCellsForDisplay(counts, 16, 16);

		assertEquals(4, result.cellsPerRow());
		assertTrue(result.userCountByCell().size() <= 16);
		assertEquals(200, total(result));
	}

	@Test
	void keepsOriginalCellsWhenAlreadyUnderLimit() {
		Map<Cell, Integer> counts = Map.of(
				new Cell(1, 1), 2,
				new Cell(2, 2), 0,
				new Cell(3, 3), 4);

		CombinedCells result = ViewportCellCalculator.combineNearbyCellsForDisplay(counts, 64, 16);

		assertEquals(16, result.cellsPerRow());
		assertEquals(Map.of(new Cell(1, 1), 2, new Cell(3, 3), 4), result.userCountByCell());
	}

	/** 16×16 격자의 앞쪽 셀에 한 명씩 채운다. */
	private static Map<Cell, Integer> counts(int size) {
		Map<Cell, Integer> result = new LinkedHashMap<>();
		for (int i = 0; i < size; i++) {
			result.put(new Cell(i % 16, i / 16), 1);
		}
		return result;
	}

	/** 합친 뒤 전체 사용자 수를 계산한다. */
	private static int total(CombinedCells cells) {
		return cells.userCountByCell().values().stream().mapToInt(Integer::intValue).sum();
	}

	private MusicPositionCalculator mapper(int grid) {
		RealtimeProperties.ViewportSettings viewport = new RealtimeProperties.ViewportSettings(
				grid, Math.min(36, grid * grid), 20, 64, 250, 5000);
		return new MusicPositionCalculator(new RealtimeProperties(
				new RealtimeProperties.Presence(15_000, 45_000, 10_000, 60_000),
				new RealtimeProperties.Nearby(10, 12),
				viewport,
				List.of(
						new RealtimeProperties.AxisRange(1, 0, 16),
						new RealtimeProperties.AxisRange(2, 0, 16))));
	}
}
