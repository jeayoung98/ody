package com.ssafy.backend.realtime.session;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.ssafy.backend.realtime.service.presence.PresenceService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** WebSocket 연결이 열리고 닫힐 때 사용자 실시간 상태를 만들고 정리한다. */
@Slf4j
@Component
@Profile("realtime")
@RequiredArgsConstructor
public class WebSocketConnectionListener {

	private final WebSocketSessionService webSocketSessionService; // 연결 정보 관리
	private final PresenceService presenceService; // 사용자 실시간 상태 관리

	@EventListener
	public synchronized void onConnected(SessionConnectedEvent event) {
		StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
		String sessionId = accessor.getSessionId();
		if (sessionId != null && event.getUser() != null) {
			String email = event.getUser().getName();
			long epoch = webSocketSessionService.register(sessionId, email);
			presenceService.connect(email, epoch);
		}
	}

	@EventListener
	public synchronized void onDisconnect(SessionDisconnectEvent event) {
		String sessionId = event.getSessionId();
		// 종료된 접속 번호만 정리한다. 이전 접속이면 Redis에서 자동으로 무시한다.
		webSocketSessionService.unregister(sessionId)
				.ifPresent(info -> presenceService.leave(info.email(), info.epoch()));
	}
}
