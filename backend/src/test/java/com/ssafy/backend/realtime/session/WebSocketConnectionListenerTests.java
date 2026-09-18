package com.ssafy.backend.realtime.session;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.security.Principal;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.ssafy.backend.realtime.service.presence.PresenceService;

/** 소켓 연결과 종료가 접속 번호와 다른 탭 여부를 어떻게 넘기는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class WebSocketConnectionListenerTests {

	private static final String EMAIL = "user@x.com";

	@Mock WebSocketSessionService webSocketSessionService;
	@Mock PresenceService presenceService;
	@Mock SessionDisconnectEvent disconnectEvent;
	@InjectMocks WebSocketConnectionListener listener;

	@Test
	@DisplayName("다른 탭이 없으면 정리해도 된다고 알린다")
	void connectReportsNoOtherSession() {
		when(webSocketSessionService.register("session-1", EMAIL)).thenReturn(1L);
		when(webSocketSessionService.hasOtherSession(EMAIL, "session-1")).thenReturn(false);

		listener.onConnected(connectedEvent("session-1"));

		verify(presenceService).connect(EMAIL, 1L, false);
	}

	@Test
	@DisplayName("다른 탭이 남아 있으면 이전 위치를 두라고 알린다")
	void connectReportsOtherSession() {
		when(webSocketSessionService.register("session-2", EMAIL)).thenReturn(2L);
		when(webSocketSessionService.hasOtherSession(EMAIL, "session-2")).thenReturn(true);

		listener.onConnected(connectedEvent("session-2"));

		verify(presenceService).connect(EMAIL, 2L, true);
	}

	@Test
	@DisplayName("다른 연결이 남아 있어도 종료된 접속 번호로 정리를 요청한다")
	void disconnectAlwaysRequestsEpochGuardedLeave() {
		String sessionId = "session-2";
		when(disconnectEvent.getSessionId()).thenReturn(sessionId);
		when(webSocketSessionService.unregister(sessionId))
				.thenReturn(Optional.of(new WebSocketSessionService.SessionInfo(EMAIL, 2L)));

		listener.onDisconnect(disconnectEvent);

		verify(presenceService).leave(EMAIL, 2L);
	}

	/** 세션 ID와 로그인 사용자를 담은 연결 완료 이벤트를 만든다. */
	private static SessionConnectedEvent connectedEvent(String sessionId) {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECTED);
		accessor.setSessionId(sessionId);
		accessor.setLeaveMutable(true);
		Message<byte[]> message = MessageBuilder.createMessage(
				new byte[0], accessor.getMessageHeaders());
		Principal user = () -> EMAIL;
		return new SessionConnectedEvent(new Object(), message, user);
	}
}
