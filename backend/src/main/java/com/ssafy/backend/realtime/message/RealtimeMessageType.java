package com.ssafy.backend.realtime.message;

/**
 * S→C 이벤트 타입. contracts/realtime-websocket.md §2 와 1:1 유지.
 * (반응은 이번 범위 밖 — 추가 시 이 enum 확장)
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
	/** 인솔자가 곡을 바꿨다 (RT-33). 동승자는 그 곡으로 옮겨 처음부터 튼다. */
	RIDE_TRACK,
	/** 인솔자의 재생·정지·구간 이동·어긋남 보정 (RT-34). */
	RIDE_PLAYBACK,
	PRESENCE_ERROR
}
