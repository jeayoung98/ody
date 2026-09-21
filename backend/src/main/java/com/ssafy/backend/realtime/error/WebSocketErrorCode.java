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
	/** 인솔자만 보낼 수 있는 곳으로 다른 사람이 보냈다. */
	RIDE_NOT_CAPTAIN,
	/** 재생 조작 종류나 재생 위치가 잘못됐다. */
	RIDE_PLAYBACK_INVALID,
	/** 곡 상세 열기·닫기 요청의 값이 잘못됐다. */
	RIDE_PANEL_INVALID
}
