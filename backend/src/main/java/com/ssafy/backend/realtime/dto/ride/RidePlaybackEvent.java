package com.ssafy.backend.realtime.dto.ride;

import com.fasterxml.jackson.annotation.JsonCreator;

/** 인솔자가 한 재생 조작의 종류. */
public enum RidePlaybackEvent {

	/** 재생 시작·이어듣기. 멈춰 있던 상태를 재생으로 바꾼다. */
	PLAY,

	/** 일시정지. 재생 중이던 상태를 멈춤으로 바꾼다. */
	PAUSE,

	/** 재생바를 옮겼다. 멈춰 있는지 틀고 있는지는 그대로 두고 위치만 바꾼다. */
	SEEK,

	/** 아무도 건드리지 않았는데 위치가 벌어졌다. 인솔자 쪽에서만 알아채서 보낸다. */
	DRIFT;

	/**
	 * 모르는 값이 오면 예외 대신 null 을 준다.
	 *
	 * 여기서 예외를 던지면 요청을 읽는 단계에서 터져 컨트롤러까지 오지 못한다.
	 * 그러면 잘못됐다고 알려줄 기회가 없어 프론트는 아무 응답도 못 받는다.
	 * null 로 흘려보내고 검사에서 잡는다.
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
