package com.ssafy.backend.realtime.geometry;

import java.util.List;

/**
 * 화면 범위(표시 2축 원시 pc 사각형) + 누적 bounds. regionId 없음 — 영역 = layer + bounds(FR-033).
 * 골격 단계: 시그니처만.
 */
public record Viewport(int layer, double minX, double maxX, double minY, double maxY, List<AxisBound> bounds) {

	public record AxisBound(int axis, double min, double max) {
	}

	/** min < max, bounds 비어있지 않음. 위반 시 예외(PRESENCE_VIEWPORT_INVALID). */
	public void validate() {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** 표시 2축 정규화 좌표가 사각형 안인지(경계 포함, FR-052). */
	public boolean contains(double x, double y) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** 원시 pc[16] 가 누적 bounds 를 모두 만족하는지(FR-053). */
	public boolean satisfiesBounds(double[] pc) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}
}
