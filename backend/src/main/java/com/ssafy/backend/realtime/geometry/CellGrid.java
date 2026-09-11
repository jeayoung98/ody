package com.ssafy.backend.realtime.geometry;

import java.util.Map;
import java.util.Set;

/**
 * 뷰포트 → 걸치는 셀 범위, 뭉침 모드 격자 반감 병합(x>>1, y>>1, FR-062). 골격 단계: 시그니처만.
 */
public final class CellGrid {

	private CellGrid() {
	}

	public record Cell(int cellX, int cellY) {
	}

	public record Folded(int resolution, Map<Cell, Integer> counts) {
	}

	/** 뷰포트가 걸치는 셀 집합(1~grid^2). */
	public static Set<Cell> cellsFor(Viewport viewport, int[] axes, int grid) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** 마커 수가 상한 이하가 될 때까지 격자 해상도 반감. */
	public static Folded foldUntil(Map<Cell, Integer> counts, int markerCap, int grid) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}
}
