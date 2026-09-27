package com.ssafy.backend.realtime.dto.ride;

/**
 * S→C RIDE_TRACK — 인솔자가 곡을 바꿨다.
 *
 * 새 곡은 처음부터 튼다. 그래서 재생 위치를 싣지 않는다.
 * 곡 제목·가수도 싣지 않는다 — 따라가는 사람이 각자 상세 조회로 가져간다.
 *
 * 받는 사람마다 재생 기록 번호가 달라서 이 알림은 사람 수만큼 만들어진다.
 * 곡과 자리는 모두에게 같으므로 한 번만 계산해 돌려 쓴다.
 *
 * @param x 지도와 같은 원시 PC 좌표
 * @param playable 재생할 수 있는 곡인지. false 면 위치만 옮기고 틀지 않는다
 * @param playHistoryId 받는 사람 자신의 이번 곡 재생 기록 번호. 다 듣고 나서 들은 시간을
 *                      저장할 때 쓴다. 번호를 받아 오지 못하면 null 이다 — 그때는 이 곡의
 *                      들은 시간을 남길 수 없지만, 곡을 옮기는 것까지 막지는 않는다
 */
public record RideTrackPayload(
		long musicId,
		int layer,
		double x,
		double y,
		boolean playable,
		long serverTs,
		Long playHistoryId) {
}
