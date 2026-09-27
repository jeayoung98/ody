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

import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorService;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;
import com.ssafy.backend.realtime.service.ride.RideGuard;
import com.ssafy.backend.realtime.session.WebSocketSessionService;

/** 주변사람 소켓 요청이 로그인 사용자 기준으로 전달되는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class NearbyWebSocketControllerTests {

	@Mock NearbyPeopleService nearbyPeopleService;
	@Mock WebSocketSessionService webSocketSessionService;
	@Mock RideGuard rideGuard;
	@Mock WebSocketErrorService webSocketErrorService;
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

	/** 조용히 넘기면 받는 쪽이 막힌 것인지 요청이 사라진 것인지 모른다. */
	@Test
	@DisplayName("따라가는 중이면 닫지 않고 오류를 보낸다")
	void ridingIsRejected() {
		org.mockito.Mockito.doThrow(new WebSocketRequestException(
				WebSocketErrorCode.RIDE_NOT_CAPTAIN, "따라가는 중에는 주변 사람을 닫을 수 없다"))
				.when(rideGuard).requireNotRiding(org.mockito.ArgumentMatchers.anyString(),
						org.mockito.ArgumentMatchers.anyString());

		controller.close(() -> "viewer@x.com", "session-1");

		verifyNoInteractions(nearbyPeopleService, webSocketSessionService);
		verify(webSocketErrorService).send(
				org.mockito.ArgumentMatchers.eq("viewer@x.com"),
				org.mockito.ArgumentMatchers.eq(WebSocketErrorCode.RIDE_NOT_CAPTAIN),
				org.mockito.ArgumentMatchers.anyString());
	}
}
