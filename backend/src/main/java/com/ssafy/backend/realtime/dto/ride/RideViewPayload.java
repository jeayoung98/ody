package com.ssafy.backend.realtime.dto.ride;

/**
 * S→C RIDE_VIEW — 인솔자가 지도를 보는 모양을 따라가는 사람들에게 알린다.
 *
 * 요청과 모양이 같다. 종류에 해당하지 않는 번호는 null 이다.
 * 내용은 담지 않는다. 받는 쪽이 평소처럼 자기가 조회한다 — 한 명이 조회에 실패해도 그 사람만 빈 화면이다.
 *
 * @param kind 보는 모양
 * @param startMusicId 여정 시작곡
 * @param endMusicId 여정 끝곡
 * @param playlistId 플레이리스트 번호
 * @param centerMusicId 주변 탐색 중심곡
 */
public record RideViewPayload(
		RideViewKind kind, Long startMusicId, Long endMusicId, Long playlistId, Long centerMusicId) {

	/** 검사가 끝난 요청을 그대로 옮긴다. 종류에 맞지 않는 번호는 버린다. */
	public static RideViewPayload from(RideViewRequest request) {
		return switch (request.kind()) {
			case DEFAULT -> new RideViewPayload(RideViewKind.DEFAULT, null, null, null, null);
			case JOURNEY -> new RideViewPayload(RideViewKind.JOURNEY,
					request.startMusicId(), request.endMusicId(), null, null);
			case PLAYLIST -> new RideViewPayload(RideViewKind.PLAYLIST, null, null, request.playlistId(), null);
			case NEARBY -> new RideViewPayload(RideViewKind.NEARBY, null, null, null, request.centerMusicId());
		};
	}
}
