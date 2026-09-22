package com.ssafy.backend.realtime.dto.ride;

/**
 * C→S /app/ride/view — 인솔자가 지도를 보는 모양을 바꿨을 때 보낸다.
 *
 * 내용(여정 경로·플레이리스트 곡)은 보내지 않는다. 받는 쪽이 이 번호로 자기가 조회한다.
 * 소켓 요청은 @Valid 가 걸리지 않아 RidePanelRequest 처럼 직접 검사한다.
 *
 * @param kind 보는 모양
 * @param startMusicId 여정 시작곡. 여정일 때만
 * @param endMusicId 여정 끝곡. 여정일 때만
 * @param playlistId 플레이리스트 번호. 플레이리스트일 때만
 * @param centerMusicId 주변 탐색 중심곡. 주변 탐색일 때만
 */
public record RideViewRequest(
		RideViewKind kind, Long startMusicId, Long endMusicId, Long playlistId, Long centerMusicId) {

	/** 요청값을 검사한다. 종류마다 있어야 하는 번호가 다르다. */
	public void validate() {
		if (kind == null) {
			throw new IllegalArgumentException("화면 종류가 비어 있거나 모르는 값이다");
		}
		switch (kind) {
			case JOURNEY -> {
				requirePositive(startMusicId, "여정에는 시작곡 번호가 있어야 한다");
				requirePositive(endMusicId, "여정에는 끝곡 번호가 있어야 한다");
			}
			case PLAYLIST -> requirePositive(playlistId, "플레이리스트에는 번호가 있어야 한다");
			case NEARBY -> requirePositive(centerMusicId, "주변 탐색에는 중심곡 번호가 있어야 한다");
			case DEFAULT -> {
				// 기본 지도는 번호가 필요 없다.
			}
		}
	}

	private static void requirePositive(Long value, String message) {
		if (value == null || value <= 0) {
			throw new IllegalArgumentException(message);
		}
	}
}
