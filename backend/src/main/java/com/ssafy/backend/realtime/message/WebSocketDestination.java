package com.ssafy.backend.realtime.message;

/**
 * destination 문자열 상수. 문자열이 흩어지면 오타 하나가 조용한 버그가 된다.
 * contracts/realtime-websocket.md §0·§2 와 1:1 유지.
 * 이번 범위: 모든 S→C 는 개인 큐(서버가 구독 인덱스로 수신자를 정한다). 토픽 브로드캐스트 없음.
 */
public final class WebSocketDestination {

	private WebSocketDestination() {
	}

	/** 사용자 상태 목록과 변경 알림을 받는 개인 큐. */
	public static final String QUEUE_PRESENCE = "/queue/presence";
	/** 개인 오류 큐 (구독: /user/queue/errors). */
	public static final String QUEUE_ERRORS = "/queue/errors";

	/**
	 * C→S 인솔자 재생 조작.
	 * 클라이언트가 보내는 전체 경로는 /app/ride/playback 이고, 받는 쪽은 앞의 /app 을 뗀 값을 쓴다.
	 */
	public static final String APP_RIDE_PLAYBACK = "/ride/playback";
}
