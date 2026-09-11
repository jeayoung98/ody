package com.ssafy.backend.realtime.session;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.ssafy.backend.realtime.presence.service.PresenceLifecycleService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

// CONNECT/DISCONNECT 이벤트 감지해서 presence 생성/정리 트리거 (FR-020, RT-05).
// 정상 종료(onClose)는 TTL 을 기다리지 않고 즉시 정리한다.
// 정리 로직은 PresenceLifecycleService(내부작업).

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketSessionEventListener {

	private final WebSocketSessionRegistry registry;
	private final PresenceLifecycleService presenceLifecycleService;

	@EventListener
	public void onConnected(SessionConnectedEvent event) {
		StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
		String sessionId = accessor.getSessionId();
		if (sessionId != null && event.getUser() != null) {
			registry.register(sessionId, event.getUser().getName());
		}
		// TODO(내부작업): presenceLifecycleService.connect(email, epoch)
	}

	@EventListener
	public void onDisconnect(SessionDisconnectEvent event) {
		String sessionId = event.getSessionId();
		registry.unregister(sessionId).ifPresent(email -> {
			// 멀티탭: 다른 세션이 남아 있으면 정리하지 않는다
			if (registry.hasOtherSession(email, sessionId)) {
				return;
			}
			// TODO(내부작업): presenceLifecycleService.leave(email, epoch)
		});
	}
}
