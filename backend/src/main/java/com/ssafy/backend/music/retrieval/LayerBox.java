package com.ssafy.backend.music.retrieval;

/**
 * 한 레이어 평면에서 클라이언트가 좁힌 사각 범위 (D19).
 *
 * 레이어 n 의 평면은 PC(2n-1)·PC(2n) 이므로 x 는 PC(2n-1), y 는 PC(2n) 축이다.
 * 서버가 이 범위를 만들어내지 않는다 — 클라이언트 뷰포트가 정해 전달한다.
 */
public record LayerBox(int layer, double xMin, double yMin, double xMax, double yMax) {

	public LayerBox {
		if (layer < 1) {
			throw new IllegalArgumentException("layer 는 1 이상이어야 한다: " + layer);
		}
		if (xMin > xMax || yMin > yMax) {
			throw new IllegalArgumentException(
					"범위가 뒤집혔다: x[%s, %s] y[%s, %s]".formatted(xMin, xMax, yMin, yMax));
		}
	}

	/** 이 레이어가 쓰는 x 축 번호 (1-based). layer 1 → pc1 */
	public int axisX() {
		return 2 * layer - 1;
	}

	/** 이 레이어가 쓰는 y 축 번호 (1-based). layer 1 → pc2 */
	public int axisY() {
		return 2 * layer;
	}
}
