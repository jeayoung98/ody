package com.ssafy.backend.realtime.controller.websocket;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;
import com.ssafy.backend.realtime.session.WebSocketSessionService;

/** 주변사람 소켓 요청이 로그인 사용자 기준으로 전달되는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class NearbyWebSocketControllerTests {

	@Mock NearbyPeopleService nearbyPeopleService;
	@Mock WebSocketSessionService webSocketSessionService;
	@InjectMocks NearbyWebSocketController controller;

	@Test
	@DisplayName("close는 로그인 사용자와 현재 접속 버전으로 구독을 닫는다")
	void closeUsesPrincipalAndEpoch() {
		when(webSocketSessionService.findEpoch("session-1")).thenReturn(Optional.of(7L));

		controller.close(() -> "viewer@x.com", "session-1");

		verify(nearbyPeopleService).close("viewer@x.com", 7L);
	}

	@Test
	@DisplayName("등록되지 않은 세션은 구독을 닫지 않는다")
	void unknownSessionDoesNotCloseSubscriptions() {
		when(webSocketSessionService.findEpoch("unknown")).thenReturn(Optional.empty());

		controller.close(() -> "viewer@x.com", "unknown");

		verifyNoInteractions(nearbyPeopleService);
	}
}
