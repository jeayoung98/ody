package com.ssafy.backend.realtime.session;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.ssafy.backend.realtime.service.presence.PresenceService;

/** 소켓 종료가 해당 접속 번호만 정리하는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class WebSocketConnectionListenerTests {

	@Mock WebSocketSessionService webSocketSessionService;
	@Mock PresenceService presenceService;
	@Mock SessionDisconnectEvent disconnectEvent;
	@InjectMocks WebSocketConnectionListener listener;

	@Test
	@DisplayName("다른 연결이 남아 있어도 종료된 접속 번호로 정리를 요청한다")
	void disconnectAlwaysRequestsEpochGuardedLeave() {
		String sessionId = "session-2";
		String email = "user@x.com";
		when(disconnectEvent.getSessionId()).thenReturn(sessionId);
		when(webSocketSessionService.unregister(sessionId))
				.thenReturn(Optional.of(new WebSocketSessionService.SessionInfo(email, 2L)));

		listener.onDisconnect(disconnectEvent);

		verify(presenceService).leave(email, 2L);
	}
}
