package com.ssafy.backend.realtime.controller.websocket;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.dto.ride.RidePanelRequest;
import com.ssafy.backend.realtime.dto.ride.RidePanelTab;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackEvent;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackRequest;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorService;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.service.ride.RidePanelService;
import com.ssafy.backend.realtime.service.ride.RidePlaybackService;
import com.ssafy.backend.realtime.session.WebSocketSessionService;

/** 재생 조작과 곡 상세 소켓 요청이 알맞게 넘어가고, 실패는 개인 오류 큐로 나가는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RideWebSocketControllerTests {

	private static final String EMAIL = "captain@x.com";

	@Mock RidePlaybackService ridePlaybackService;
	@Mock RidePanelService ridePanelService;
	@Mock WebSocketSessionService webSocketSessionService;
	@Mock WebSocketErrorService webSocketErrorService;
	@InjectMocks RideWebSocketController controller;

	@Test
	@DisplayName("정상 요청은 로그인 사용자 기준으로 넘긴다")
	void relaysRequest() {
		when(webSocketSessionService.findEpoch("session-1")).thenReturn(Optional.of(7L));
		RidePlaybackRequest request = new RidePlaybackRequest(RidePlaybackEvent.PLAY, 1_000L);

		controller.playback(request, () -> EMAIL, "session-1");

		verify(ridePlaybackService).relay(EMAIL, request);
	}

	@Test
	@DisplayName("등록되지 않은 세션은 넘기지 않고 오류를 보낸다")
	void unknownSessionSendsError() {
		when(webSocketSessionService.findEpoch("unknown")).thenReturn(Optional.empty());

		controller.playback(new RidePlaybackRequest(RidePlaybackEvent.PLAY, 1_000L),
				() -> EMAIL, "unknown");

		verify(ridePlaybackService, never()).relay(anyString(), any());
		verify(webSocketErrorService).send(eq(EMAIL),
				eq(WebSocketErrorCode.PRESENCE_NOT_CONNECTED), anyString());
	}

	@Test
	@DisplayName("빈 요청은 잘못된 요청으로 알린다")
	void nullRequestSendsInvalid() {
		when(webSocketSessionService.findEpoch("session-1")).thenReturn(Optional.of(7L));

		controller.playback(null, () -> EMAIL, "session-1");

		verify(webSocketErrorService).send(eq(EMAIL),
				eq(WebSocketErrorCode.RIDE_PLAYBACK_INVALID), anyString());
	}

	@Test
	@DisplayName("검사에서 걸린 값은 잘못된 요청으로 알린다")
	void invalidValueSendsInvalid() {
		when(webSocketSessionService.findEpoch("session-1")).thenReturn(Optional.of(7L));
		doThrow(new IllegalArgumentException("재생 위치는 0 이상이어야 한다"))
				.when(ridePlaybackService).relay(anyString(), any());

		controller.playback(new RidePlaybackRequest(RidePlaybackEvent.PLAY, -1L),
				() -> EMAIL, "session-1");

		verify(webSocketErrorService).send(eq(EMAIL),
				eq(WebSocketErrorCode.RIDE_PLAYBACK_INVALID), anyString());
	}

	@Test
	@DisplayName("인솔자가 아니라는 거부는 그 코드 그대로 알린다")
	void notCaptainKeepsCode() {
		when(webSocketSessionService.findEpoch("session-1")).thenReturn(Optional.of(7L));
		doThrow(new WebSocketRequestException(
				WebSocketErrorCode.RIDE_NOT_CAPTAIN, "따라가는 중에는 재생 조작을 보낼 수 없다"))
				.when(ridePlaybackService).relay(anyString(), any());

		controller.playback(new RidePlaybackRequest(RidePlaybackEvent.PAUSE, 1_000L),
				() -> EMAIL, "session-1");

		verify(webSocketErrorService).send(eq(EMAIL),
				eq(WebSocketErrorCode.RIDE_NOT_CAPTAIN), anyString());
	}

	@Test
	@DisplayName("곡 상세 요청은 로그인 사용자 기준으로 넘긴다")
	void relaysPanelRequest() {
		when(webSocketSessionService.findEpoch("session-1")).thenReturn(Optional.of(7L));
		RidePanelRequest request = new RidePanelRequest(true, 4927L, RidePanelTab.INFO);

		controller.panel(request, () -> EMAIL, "session-1");

		verify(ridePanelService).relay(EMAIL, request);
	}

	@Test
	@DisplayName("빈 곡 상세 요청은 잘못된 요청으로 알린다")
	void nullPanelRequestSendsInvalid() {
		when(webSocketSessionService.findEpoch("session-1")).thenReturn(Optional.of(7L));

		controller.panel(null, () -> EMAIL, "session-1");

		verify(webSocketErrorService).send(eq(EMAIL),
				eq(WebSocketErrorCode.RIDE_PANEL_INVALID), anyString());
	}

	@Test
	@DisplayName("곡 상세도 등록되지 않은 세션은 넘기지 않는다")
	void unknownSessionSkipsPanel() {
		when(webSocketSessionService.findEpoch("unknown")).thenReturn(Optional.empty());

		controller.panel(new RidePanelRequest(false, null, null), () -> EMAIL, "unknown");

		verify(ridePanelService, never()).relay(anyString(), any());
		verify(webSocketErrorService).send(eq(EMAIL),
				eq(WebSocketErrorCode.PRESENCE_NOT_CONNECTED), anyString());
	}

	@Test
	@DisplayName("곡 상세에서 인솔자가 아니라는 거부는 그 코드 그대로 알린다")
	void panelNotCaptainKeepsCode() {
		when(webSocketSessionService.findEpoch("session-1")).thenReturn(Optional.of(7L));
		doThrow(new WebSocketRequestException(
				WebSocketErrorCode.RIDE_NOT_CAPTAIN, "따라가는 중에는 곡 상세를 바꿀 수 없다"))
				.when(ridePanelService).relay(anyString(), any());

		controller.panel(new RidePanelRequest(true, 4927L, RidePanelTab.NEARBY),
				() -> EMAIL, "session-1");

		verify(webSocketErrorService).send(eq(EMAIL),
				eq(WebSocketErrorCode.RIDE_NOT_CAPTAIN), anyString());
	}
}
