package com.ssafy.backend.artwork.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * "artwork_point" 단건 row (MyBatis 결과·파라미터 겸용, mutable).
 *
 * <p>제출 시점에 굳은 좌표다. 다시 계산하지 않는다 — 점수는 이 그림에 매겨진 것이라
 * 좌표 baseline 이 바뀌어도 작품은 그대로여야 한다.
 */
@Getter
@Setter
@NoArgsConstructor
public class ArtworkPointRow {
	/** 여러 작품의 좌표를 한 번에 읽을 때만 채운다 (S15P21A405-616 리더보드). */
	private long artworkId;

	/** 제출 시점 곡 순서. 0부터. 선을 잇는 순서이기도 하다. */
	private int position;
	private long musicId;
	/** -1 ~ 1 */
	private double x;
	/** -1 ~ 1. 위가 양수다. */
	private double y;

	/** 한 작품의 좌표 한 점. 여러 작품을 한 번에 읽을 때만 {@code artworkId} 를 MyBatis 가 채운다. */
	public ArtworkPointRow(int position, long musicId, double x, double y) {
		this.position = position;
		this.musicId = musicId;
		this.x = x;
		this.y = y;
	}
}
