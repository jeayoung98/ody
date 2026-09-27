package com.ssafy.backend.realtime.geometry;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 화면이 걸치는 셀을 찾고, 표시할 셀이 많으면 이웃 셀끼리 합친다.
 */
public final class ViewportCellCalculator {

	private ViewportCellCalculator() {
	}

	/**
	 * 기본 격자의 한 칸.
	 *
	 * @param cellX 가로 칸 번호
	 * @param cellY 세로 칸 번호
	 */
	public record Cell(int cellX, int cellY) {
	}

	/**
	 * 가까운 셀을 합친 뒤의 화면 표시 정보.
	 * @param cellsPerRow 한 줄에 표시할 셀 수
	 * @param userCountByCell 셀마다 표시할 사용자 수
	 */
	public record CombinedCells(int cellsPerRow, Map<Cell, Integer> userCountByCell) {
		/** 결과가 밖에서 바뀌지 않도록 복사한다. */
		public CombinedCells {
			userCountByCell = Map.copyOf(userCountByCell);
		}
	}

	/**
	 * 현재 화면이 걸치는 모든 기본 셀을 찾는다.
	 * @param viewport 현재 화면 범위
	 * @param mapper 원시 좌표를 셀 번호로 바꾸는 도구
	 * @return 현재 화면과 겹치는 셀 목록
	 * @throws NullPointerException 화면 범위나 좌표 변환기가 없는 경우
	 * @throws IllegalArgumentException 화면 범위가 잘못된 경우
	 */
	public static Set<Cell> findCellsInCurrentScreen(ViewportRange viewport, MusicPositionCalculator mapper) {
		Objects.requireNonNull(viewport, "화면 범위가 필요하다");
		Objects.requireNonNull(mapper, "좌표 변환기가 필요하다");
		viewport.validate();

		int[] axes = mapper.findAxes(viewport.layer());
		int minCellX = mapper.findCell(viewport.minX(), axes[0]);
		int maxCellX = mapper.findCell(viewport.maxX(), axes[0]);
		int minCellY = mapper.findCell(viewport.minY(), axes[1]);
		int maxCellY = mapper.findCell(viewport.maxY(), axes[1]);

		Set<Cell> cells = new LinkedHashSet<>();
		for (int cellX = minCellX; cellX <= maxCellX; cellX++) {
			for (int cellY = minCellY; cellY <= maxCellY; cellY++) {
				cells.add(new Cell(cellX, cellY));
			}
		}
		return cells;
	}

	/**
	 * 화면에 표시할 셀 수가 제한 이하가 될 때까지 이웃 셀을 합친다.
	 * @param originalUserCountByCell 합치기 전 셀별 사용자 수
	 * @param maxCellsToDisplay 화면에 표시할 최대 셀 수
	 * @param originalCellsPerRow 합치기 전 한 줄의 셀 수
	 * @return 합친 뒤의 셀별 사용자 수
	 */
	public static CombinedCells combineNearbyCellsForDisplay(
			Map<Cell, Integer> originalUserCountByCell,
			int maxCellsToDisplay,
			int originalCellsPerRow) {
		Objects.requireNonNull(originalUserCountByCell, "셀별 사용자 수가 필요하다");
		if (maxCellsToDisplay < 1) {
			throw new IllegalArgumentException("표시할 셀 수는 1 이상이어야 한다");
		}
		if (originalCellsPerRow < 1 || (originalCellsPerRow & (originalCellsPerRow - 1)) != 0) {
			throw new IllegalArgumentException("한 줄의 셀 수는 2의 제곱수여야 한다");
		}

		Map<Cell, Integer> current = positiveCells(originalUserCountByCell, originalCellsPerRow);
		int cellsPerRow = originalCellsPerRow;
		while (current.size() > maxCellsToDisplay && cellsPerRow > 1) {
			current = combineTwoByTwo(current);
			cellsPerRow /= 2;
		}
		return new CombinedCells(cellsPerRow, current);
	}

	/** 사용자 수가 있는 올바른 셀만 셀 번호 순서로 복사한다. */
	private static Map<Cell, Integer> positiveCells(Map<Cell, Integer> source, int cellsPerRow) {
		Map<Cell, Integer> result = new LinkedHashMap<>();
		source.entrySet().stream()
				.sorted(Map.Entry.comparingByKey(Comparator
						.comparingInt(Cell::cellX)
						.thenComparingInt(Cell::cellY)))
				.forEach(entry -> {
					Cell cell = Objects.requireNonNull(entry.getKey(), "셀 위치가 필요하다");
					Integer count = Objects.requireNonNull(entry.getValue(), "사용자 수가 필요하다");
					if (cell.cellX() < 0 || cell.cellX() >= cellsPerRow
							|| cell.cellY() < 0 || cell.cellY() >= cellsPerRow) {
						throw new IllegalArgumentException("셀 번호가 격자 범위를 벗어났다");
					}
					if (count < 0) {
						throw new IllegalArgumentException("사용자 수는 음수일 수 없다");
					}
					if (count > 0) {
						result.put(cell, count);
					}
				});
		return result;
	}

	/** 이웃한 2×2 셀의 사용자 수를 하나로 합친다. */
	private static Map<Cell, Integer> combineTwoByTwo(Map<Cell, Integer> source) {
		Map<Cell, Integer> result = new LinkedHashMap<>();
		for (Map.Entry<Cell, Integer> entry : source.entrySet()) {
			Cell cell = entry.getKey();
			Cell combined = new Cell(cell.cellX() / 2, cell.cellY() / 2);
			result.merge(combined, entry.getValue(), Math::addExact);
		}
		return result;
	}
}
