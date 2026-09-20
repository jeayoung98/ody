package com.ssafy.backend.realtime.dto.ride;

/**
 * C→S /app/ride/playback — 인솔자의 재생·정지·구간 이동·어긋남 보정 (RT-34).
 *
 * <p>소켓 요청은 @Valid 가 걸리지 않아 JoinRequest 와 같이 직접 검사한다.
 * 500ms 발행 간격 제한과 1.5초 어긋남 감지는 프론트 몫이라 서버는 받는 대로 중계만 한다.
 */
public record RidePlaybackRequest(RidePlaybackEvent event, Long positionMs) {

	/** 요청값을 검사한다. */
	public void validate() {
		if (event == null) {
			throw new IllegalArgumentException("재생 이벤트 종류가 비어 있거나 모르는 값이다");
		}
		if (positionMs == null || positionMs < 0) {
			throw new IllegalArgumentException("재생 위치는 0 이상이어야 한다");
		}
	}
}
