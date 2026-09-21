package com.ssafy.backend.realtime.dto.ride;

/**
 * S→C RIDE_ENDED — 인솔자가 사라져 따라가기가 끝났다고 알린다.
 *
 * 받은 사람은 인솔자가 마지막으로 있던 곡에 단독으로 남는다. 듣던 곡은 끊기지 않는다.
 * 스스로 내렸을 때와 같은 상태이므로, 그때와 같은 자리 정보를 준다.
 *
 * @param captainEmail 사라진 인솔자
 * @param reason 끝난 이유
 * @param musicId 남게 된 곡
 * @param layer 남게 된 레이어
 * @param x 지도 가로 좌표
 * @param y 지도 세로 좌표
 * @param cellX 자리의 가로 칸
 * @param cellY 자리의 세로 칸
 */
public record RideEndedPayload(
		String captainEmail,
		RideEndReason reason,
		long musicId,
		int layer,
		double x,
		double y,
		int cellX,
		int cellY) {
}
