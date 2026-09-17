package com.ssafy.backend.realtime.message;

/**
 * S→C 이벤트 타입. contracts/realtime-websocket.md §2 와 1:1 유지.
 * (반응·따라가기는 이번 범위 밖 — 추가 시 이 enum 확장)
 */
public enum RealtimeMessageType {
	PRESENCE_JOINED,
	VIEWPORT_SNAPSHOT,
	VIEWPORT_ENTER,
	VIEWPORT_MOVE,
	VIEWPORT_LEAVE,
	VIEWPORT_CELL_COUNTS,
	NEARBY_SNAPSHOT,
	NEARBY_ENTER,
	NEARBY_MOVE,
	NEARBY_LEAVE,
	PRESENCE_ERROR
}
