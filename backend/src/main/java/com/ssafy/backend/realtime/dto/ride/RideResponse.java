package com.ssafy.backend.realtime.dto.ride;

/**
 * 따라가기 응답. 어디에 서게 됐고 무슨 곡을 어디서부터 틀면 되는지 준다.
 *
 * musicId·layer·x·y·cellX·cellY 는 {@code PlayResponse} 와 같다.
 * playHistoryId 는 따라가는 사람 자신의 재생 기록이다. 나중에 재생 시간을 저장할 때 쓴다.
 * positionMs 는 서버가 계산해서 준다 — 클라이언트가 직접 빼면 기기 시계가 틀린 만큼 어긋난다.
 * snapshotSeq 는 이 응답이 언제 것인지다. 이보다 작은 소켓 이벤트는 버린다.
 * panel 은 인솔자가 지금 열어 둔 곡 상세다. 중간에 탄 사람도 같은 화면을 보게 하려고 같이 준다.
 */
public record RideResponse(
		String captainEmail,
		long playHistoryId,
		long musicId,
		int layer,
		double x,
		double y,
		int cellX,
		int cellY,
		PlaybackState playback,
		long positionMs,
		long snapshotSeq,
		RidePanelPayload panel) {
}
