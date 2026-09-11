package com.ssafy.backend.realtime.geometry;

import java.util.Optional;

/**
 * 레이어 → 표시 축 쌍. 레이어 l 은 PC(2l-1), PC(2l) 을 쓴다(FR-031). 배정표는 yml.
 * 골격 단계: 시그니처만.
 */
public final class LayerAxes {

	private LayerAxes() {
	}

	/** @return (axisX, axisY) 1-based. 배정표에 없으면 empty. */
	public static Optional<int[]> axesOf(int layer) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}
}
