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
			// 탭을 여러 개 켜도 마지막 것만 산다. 앞의 탭은 접속 번호가 달라져 그 뒤 요청이 전부 거부된다.
			presenceService.connect(email, epoch);
		}
	}

	@EventListener
	public synchronized void onDisconnect(SessionDisconnectEvent event) {
		String sessionId = event.getSessionId();
		// 종료된 접속 번호만 정리한다. 앞의 탭이 닫힌 것이면 Redis 가 건너뛰고,
		// PresenceService 가 그 사실을 보고 따라가기도 그대로 둔다.
		webSocketSessionService.unregister(sessionId)
				.ifPresent(info -> presenceService.leave(info.email(), info.epoch()));
	}
}
