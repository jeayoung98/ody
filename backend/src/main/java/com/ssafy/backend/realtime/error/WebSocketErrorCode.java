package com.ssafy.backend.realtime.error;

/** WebSocket 오류 메시지의 세부 코드. */
public enum WebSocketErrorCode {
	PRESENCE_NO_ANCHOR,
	PRESENCE_LOCATION_NULL,
	PRESENCE_LAYER_INVALID,
	PRESENCE_JOIN_INVALID,
	PRESENCE_VIEWPORT_INVALID,
	PRESENCE_STALE,
	PRESENCE_NOT_CONNECTED,
	/** 인솔자가 아닌 사람이 인솔자 전용 목적지로 보냈다 (RT-34·RT-36). */
	RIDE_NOT_CAPTAIN,
	/** 재생 이벤트 종류나 재생 위치가 잘못됐다 (RT-34). */
	RIDE_PLAYBACK_INVALID
}
