package com.ssafy.backend.realtime.geometry;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 화면이 걸치는 셀을 찾고, 표시할 셀이 많으면 이웃 셀끼리 합친다.
 */
public final class CellGrid {

	private CellGrid() {
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
	}

	/**
	 * 현재 화면이 걸치는 모든 기본 셀을 찾는다.
	 * @param viewport 현재 화면 범위
	 * @param mapper 원시 좌표를 셀 번호로 바꾸는 도구
	 * @return 현재 화면과 겹치는 셀 목록
	 * @throws NullPointerException 화면 범위나 좌표 변환기가 없는 경우
	 * @throws IllegalArgumentException 화면 범위가 잘못된 경우
	 */
	public static Set<Cell> findCellsInCurrentScreen(Viewport viewport, CoordinateMapper mapper) {
		Objects.requireNonNull(viewport, "화면 범위가 필요하다");
		Objects.requireNonNull(mapper, "좌표 변환기가 필요하다");
		viewport.validate();

		int[] axes = mapper.axesOf(viewport.layer());
		int minCellX = mapper.cellAt(viewport.minX(), axes[0]);
		int maxCellX = mapper.cellAt(viewport.maxX(), axes[0]);
		int minCellY = mapper.cellAt(viewport.minY(), axes[1]);
		int maxCellY = mapper.cellAt(viewport.maxY(), axes[1]);

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
		throw new UnsupportedOperationException("TODO(내부작업)");
	}
}
