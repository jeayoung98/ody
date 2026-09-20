package com.ssafy.backend.realtime.dto.ride;

import com.fasterxml.jackson.annotation.JsonCreator;

/**
 * 인솔자가 보낸 재생 조작의 종류 (RT-34).
 *
 * <p>SEEK 와 DRIFT 는 재생 중인지 멈춰 있는지를 바꾸지 않는다 —
 * 멈춘 채로 재생바만 옮기는 경우가 있기 때문이다.
 */
public enum RidePlaybackEvent {

	/** 재생 시작·재개. 멈춰 있던 상태를 재생으로 바꾼다. */
	PLAY,

	/** 일시정지. 재생 중이던 상태를 정지로 바꾼다. */
	PAUSE,

	/** 재생바를 옮겼다. 상태는 그대로 두고 위치만 바꾼다. */
	SEEK,

	/** 아무도 조작하지 않았는데 위치가 벌어졌다(버퍼링 등). 인솔자 쪽에서만 감지해 보낸다. */
	DRIFT;

	/**
	 * 모르는 값이 오면 예외 대신 null 을 준다.
	 *
	 * <p>여기서 예외를 던지면 역직렬화 단계에서 터져 컨트롤러까지 오지 않는다.
	 * 그러면 오류 큐로 RIDE_PLAYBACK_INVALID 를 보낼 기회가 없어 프론트는 아무 응답도 못 받는다.
	 * null 로 흘려보내고 검증에서 잡는다.
	 */
	@JsonCreator
	public static RidePlaybackEvent from(String value) {
		for (RidePlaybackEvent event : values()) {
			if (event.name().equals(value)) {
				return event;
			}
		}
		return null;
	}
}
