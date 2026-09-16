package com.ssafy.backend.realtime.messaging;

/**
 * 발행 인터페이스 — 모든 브로드캐스트는 이것만 호출
 * 각 서비스에서 SimpMessagingTemplate 을 직접 호출하지 말 것.
 */
public interface RealtimePublisher {

	/** 특정 사용자 개인 큐로 발행(/user/queue/...). seq 는 구현체가 세션 단위로 발급한다. */
	void publishToUser(String userId, String destination, RealtimeEventType type, Object payload);
}
