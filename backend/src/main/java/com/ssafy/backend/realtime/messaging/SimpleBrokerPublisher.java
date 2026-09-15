package com.ssafy.backend.realtime.messaging;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import com.ssafy.backend.realtime.session.WebSocketSessionRegistry;

import lombok.RequiredArgsConstructor;

/**
 * MVP 구현용 발신 창구— SimpleBroker(messagingTemplate) 위임. seq 는 세션 레지스트리에서 발급한다.
 * WS 서버 다중화 시 RedisBridgePublisher 로 교체(R-09, 지금은 미작성).
 *
 * 개인 큐로 보내는 모든 메시지에 사용자 연결 단위 seq와 공통 봉투를 붙인다.
 */
@Component
@RequiredArgsConstructor
public class SimpleBrokerPublisher implements RealtimePublisher {

	private final SimpMessagingTemplate messagingTemplate;
	private final WebSocketSessionRegistry sessionRegistry;

	@Override
	public void publishToUser(String userId, String destination, RealtimeEventType type, Object payload) {
		long seq = sessionRegistry.nextSeq(userId);
		messagingTemplate.convertAndSendToUser(userId, destination, RealtimeEnvelope.of(type, seq, payload));
	}
}
