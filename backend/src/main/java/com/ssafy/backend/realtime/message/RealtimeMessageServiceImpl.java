package com.ssafy.backend.realtime.message;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import com.ssafy.backend.realtime.session.WebSocketSessionService;

import lombok.RequiredArgsConstructor;

/** 메시지에 순번을 붙여 Spring WebSocket 개인 큐로 보낸다. */
@Component
@RequiredArgsConstructor
public class RealtimeMessageServiceImpl implements RealtimeMessageService {

	private final SimpMessagingTemplate messagingTemplate; // Spring WebSocket 전송 도구
	private final WebSocketSessionService webSocketSessionService; // 사용자별 메시지 순번 관리

	@Override
	public void sendToUser(String userId, String destination, RealtimeMessageType type, Object payload) {
		long seq = webSocketSessionService.nextMessageSeq(userId);
		messagingTemplate.convertAndSendToUser(userId, destination, RealtimeMessage.of(type, seq, payload));
	}
}
