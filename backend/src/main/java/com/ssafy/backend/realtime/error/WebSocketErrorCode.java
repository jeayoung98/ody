package com.ssafy.backend.realtime.error;

/** WebSocket 오류 메시지의 세부 코드. */
public enum WebSocketErrorCode {
	PRESENCE_NO_ANCHOR,
	PRESENCE_LOCATION_NULL,
	PRESENCE_LAYER_INVALID,
	PRESENCE_VIEWPORT_INVALID,
	PRESENCE_STALE,
	PRESENCE_NOT_CONNECTED
}
