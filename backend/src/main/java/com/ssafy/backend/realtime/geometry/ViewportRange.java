package com.ssafy.backend.realtime.geometry;

import java.util.List;

/**
 * 현재 화면과 여기까지 내려오며 선택한 이전 화면들.
 *
 * @param layer 현재 레이어 (0-based, 0 ~ 7)
 * @param minX 현재 화면의 최소 x 좌표
 * @param maxX 현재 화면의 최대 x 좌표
 * @param minY 현재 화면의 최소 y 좌표
 * @param maxY 현재 화면의 최대 y 좌표
 * @param ancestorBounds 이전 레이어에서 선택한 화면 목록
 */
public record ViewportRange(
		int layer,
		double minX, double maxX,
		double minY, double maxY,
		List<LayerBound> ancestorBounds) {

	/** 레이어 수. 유효 번호는 0 ~ 7 (프론트와 같은 0-based). */
	private static final int LAYER_COUNT = 8;

	/** 이전 화면 목록이 밖에서 바뀌지 않도록 복사한다. */
	public ViewportRange {
		ancestorBounds = ancestorBounds == null ? null : List.copyOf(ancestorBounds);
	}

	/**
	 * 레이어 번호와 현재·이전 화면 범위를 검사한다.
	 * @throws IllegalArgumentException 레이어, 범위 또는 이전 화면 순서가 잘못된 경우
	 */
	public void validate() {
		if (layer < 0 || layer >= LAYER_COUNT) {
			throw new IllegalArgumentException("레이어는 0부터 7까지다");
		}
		validateRange(minX, maxX, "현재 x 범위");
		validateRange(minY, maxY, "현재 y 범위");
		if (ancestorBounds == null || ancestorBounds.size() != layer) {
			throw new IllegalArgumentException("이전 레이어 범위 수가 맞지 않는다");
		}
		for (int i = 0; i < ancestorBounds.size(); i++) {
			LayerBound bound = ancestorBounds.get(i);
			if (bound == null || bound.layer() != i) {
				throw new IllegalArgumentException("이전 레이어 순서가 맞지 않는다");
			}
			validateRange(bound.minX(), bound.maxX(), "이전 x 범위");
			validateRange(bound.minY(), bound.maxY(), "이전 y 범위");
		}
	}

	/**
	 * 좌표가 현재 화면 안인지 확인한다. 경계도 화면 안으로 본다.
	 * @param x 확인할 x 좌표
	 * @param y 확인할 y 좌표
	 * @return 현재 화면 안이면 true
	 */
	public boolean contains(double x, double y) {
		return Double.isFinite(x) && Double.isFinite(y)
				&& x >= minX && x <= maxX
				&& y >= minY && y <= maxY;
	}

	/**
	 * 곡이 내려온 경로 안에 계속 있었는지 확인한다.
	 * @param pc 곡의 16차원 좌표
	 * @return 모든 이전 화면 안에 있으면 true
	 */
	public boolean satisfiesBounds(double[] pc) {
		if (pc == null) {
			return false;
		}
		for (LayerBound bound : ancestorBounds) {
			int xIndex = bound.layer() * 2;
			int yIndex = xIndex + 1;
			if (pc.length <= yIndex || !bound.contains(pc[xIndex], pc[yIndex])) {
				return false;
			}
		}
		return true;
	}

	/**
	 * 한 축의 최소·최대 값을 검사한다.
	 * @param min 최소값
	 * @param max 최대값
	 * @param name 오류에 표시할 범위 이름
	 * @throws IllegalArgumentException 값이 숫자가 아니거나 최소값이 작지 않은 경우
	 */
	private static void validateRange(double min, double max, String name) {
		if (!Double.isFinite(min) || !Double.isFinite(max) || min >= max) {
			throw new IllegalArgumentException(name + "가 올바르지 않다");
		}
	}

	/**
	 * 한 레이어에서 다음 레이어로 내려갈 때 선택한 화면 범위.
	 *
	 * @param layer 범위를 선택한 레이어
	 * @param minX 최소 x 좌표
	 * @param maxX 최대 x 좌표
	 * @param minY 최소 y 좌표
	 * @param maxY 최대 y 좌표
	 */
	public record LayerBound(int layer, double minX, double maxX, double minY, double maxY) {

		/**
		 * 좌표가 이 이전 화면 안인지 확인한다.
		 *
		 * @param x 확인할 x 좌표
		 * @param y 확인할 y 좌표
		 * @return 화면 안이면 true
		 */
		boolean contains(double x, double y) {
			return Double.isFinite(x) && Double.isFinite(y)
					&& x >= minX && x <= maxX
					&& y >= minY && y <= maxY;
		}
	}
}
