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
	/** 인솔자가 곡을 바꿨다. 따라가는 사람은 그 곡으로 옮겨 처음부터 튼다. */
	RIDE_TRACK,
	/** 인솔자가 재생·정지·구간 이동을 했다. */
	RIDE_PLAYBACK,
	// 아래 다섯은 인솔자가 받은 것을 그대로 옮긴 것이다. 내용은 앞의 VIEWPORT_* 와 같고
	// 이름만 다르다. 이름을 가르는 이유는 받는 쪽이 "내 화면 요청의 답"과 "인솔자 화면을
	// 옮겨 받은 것"을 헷갈리지 않게 하기 위해서다. 둘은 요청 번호의 주인이 다르다.
	/** 인솔자의 화면 목록. */
	RIDE_VIEWPORT,
	/** 인솔자 화면에 누가 새로 들어왔다. */
	RIDE_VIEWPORT_ENTER,
	/** 인솔자 화면 안의 누군가가 자리를 옮겼다. */
	RIDE_VIEWPORT_MOVE,
	/** 인솔자 화면에서 누가 빠졌다. */
	RIDE_VIEWPORT_LEAVE,
	/** 인솔자 화면의 자리별 사람 수. */
	RIDE_VIEWPORT_CELL_COUNTS,
	/** 인솔자 화면에 여러 사람이 한꺼번에 나타났다. */
	RIDE_VIEWPORT_BULK_ENTER,
	/** 인솔자가 곡 상세를 열거나 닫거나 탭을 바꿨다. */
	RIDE_PANEL,
	/** 따라오던 사람이 내렸다. 인솔자에게만 간다. */
	RIDE_RIDER_LEFT,
	/** 인솔자가 사라져 따라가기가 끝났다. 따라가던 사람에게만 간다. */
	RIDE_ENDED,
	/** 선단이 흩어져 여러 사람이 한 자리에 한꺼번에 나타났다. */
	VIEWPORT_BULK_ENTER,
	PRESENCE_ERROR
}
