package com.ssafy.backend.realtime.dto.ride;

/**
 * S→C RIDE_TRACK — 인솔자가 곡을 바꿨다.
 *
 * 새 곡은 처음부터 튼다. 그래서 재생 위치를 싣지 않는다.
 * 곡 제목·가수도 싣지 않는다 — 따라가는 사람이 각자 상세 조회로 가져간다.
 *
 * @param x 지도와 같은 원시 PC 좌표
 * @param playable 재생할 수 있는 곡인지. false 면 위치만 옮기고 틀지 않는다
 */
public record RideTrackPayload(
		long musicId,
		int layer,
		double x,
		double y,
		boolean playable,
		long serverTs) {
}
