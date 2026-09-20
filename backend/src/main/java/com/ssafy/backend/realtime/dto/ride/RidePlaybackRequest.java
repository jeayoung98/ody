package com.ssafy.backend.realtime.dto.ride;

/**
 * C→S /app/ride/playback — 인솔자가 재생·정지·구간 이동을 했을 때 보낸다.
 *
 * 소켓 요청은 @Valid 가 걸리지 않아 JoinRequest 처럼 직접 검사한다.
 */
public record RidePlaybackRequest(RidePlaybackEvent event, Long positionMs) {

	/** 요청값을 검사한다. */
	public void validate() {
		if (event == null) {
			throw new IllegalArgumentException("재생 조작 종류가 비어 있거나 모르는 값이다");
		}
		if (positionMs == null || positionMs < 0) {
			throw new IllegalArgumentException("재생 위치는 0 이상이어야 한다");
		}
	}
}
