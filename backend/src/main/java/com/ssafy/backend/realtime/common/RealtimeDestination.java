package com.ssafy.backend.realtime.common;

/**
 * destination 문자열 상수. 문자열이 흩어지면 오타 하나가 조용한 버그가 된다.
 * contracts/realtime-websocket.md §0·§2 와 1:1 유지.
 * 이번 범위: 모든 S→C 는 개인 큐(서버가 구독 인덱스로 수신자를 정한다). 토픽 브로드캐스트 없음.
 */
public final class RealtimeDestination {

	private RealtimeDestination() {
	}

	/** presence 스냅샷·델타 개인 큐 (구독: /user/queue/presence). */
	public static final String QUEUE_PRESENCE = "/queue/presence";
	/** 개인 오류 큐 (구독: /user/queue/errors). */
	public static final String QUEUE_ERRORS = "/queue/errors";
}
