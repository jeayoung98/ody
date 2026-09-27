package com.ssafy.backend.realtime.dto.ride;

/**
 * 따라가기 응답. 어디에 서게 됐고 무슨 곡을 어디서부터 틀면 되는지 준다.
 *
 * musicId·layer·x·y·cellX·cellY 는 {@code PlayResponse} 와 같다.
 * playHistoryId 는 따라가는 사람 자신의 재생 기록이다. 나중에 재생 시간을 저장할 때 쓴다.
 * positionMs 는 서버가 계산해서 준다 — 클라이언트가 직접 빼면 기기 시계가 틀린 만큼 어긋난다.
 * panel 은 인솔자가 지금 열어 둔 곡 상세다. 중간에 탄 사람도 같은 화면을 보게 하려고 같이 준다.
 *
 * snapshotSeq 는 인솔자의 재생 정보가 몇 번 바뀌었는지 세는 값이다.
 * 소켓 메시지에 붙는 번호와는 세는 대상이 다르다 — 그쪽은 받는 사람의 소켓에 몇 번째로
 * 보냈는지를 세고, 연결할 때마다 0 부터 다시 시작한다.
 *
 * 그래서 이 값으로 소켓 메시지를 거르면 안 된다. 오래 틀고 있던 인솔자는 이 값이 이미 크고
 * 방금 접속한 사람은 메시지 번호가 1 부터라, 두 값을 견주면 처음 오는 재생 알림이 전부
 * 버려진다. 오류도 로그도 남지 않아 원인을 찾기 어렵다.
 *
 * 메시지가 순서대로 왔는지는 소켓 메시지 번호끼리만 견주면 된다.
 * 이 값은 어느 쪽 재생 정보가 더 최신인지 서버 안에서 가릴 때 쓴다.
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
