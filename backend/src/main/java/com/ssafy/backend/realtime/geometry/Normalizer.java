package com.ssafy.backend.realtime.geometry;

/**
 * 원시 pc → 정규화(0~1) → 셀. cell = min(floor(xNorm*grid), grid-1), 음수는 0 클램프.
 * ★ (int) 캐스팅 금지 — 음수 pc 에서 floor 와 갈린다(FR-031). 골격 단계: 시그니처만.
 */
public final class Normalizer {

	private Normalizer() {
	}

	public static double normalize(double pc, double min, double max) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	public static int cell(double xNorm, int grid) {
		throw new UnsupportedOperationException("TODO(내부작업): Math.floor, (int) 캐스팅 금지");
	}
}
