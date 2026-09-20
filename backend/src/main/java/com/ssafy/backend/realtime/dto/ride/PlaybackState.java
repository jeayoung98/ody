package com.ssafy.backend.realtime.dto.ride;

/** 선장이 지금 틀고 있는지 멈춰 있는지. 재생 위치를 읽는 방식이 갈린다. */
public enum PlaybackState {

	/** 틀고 있음 -> 저장된 위치에 그 뒤 흐른 시간을 더해서 읽는다. */
	PLAYING,

	/** 멈춰 있다. 저장된 위치가 곧 지금 위치다. */
	PAUSED
}
