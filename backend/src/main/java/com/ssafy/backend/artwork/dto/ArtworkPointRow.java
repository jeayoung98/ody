package com.ssafy.backend.artwork.dto;

import lombok.AllArgsConstructor;
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
@AllArgsConstructor
public class ArtworkPointRow {

	/** 제출 시점 곡 순서. 0부터. 선을 잇는 순서이기도 하다. */
	private int position;
	private long musicId;
	/** -1 ~ 1 */
	private double x;
	/** -1 ~ 1. 위가 양수다. */
	private double y;
}
