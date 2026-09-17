package com.ssafy.backend.realtime.controller.websocket;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.security.Principal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorService;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.dto.presence.ViewportRequest;
import com.ssafy.backend.realtime.dto.presence.ViewportCloseRequest;
import com.ssafy.backend.realtime.service.presence.PresenceService;
import com.ssafy.backend.realtime.session.WebSocketSessionService;
import com.ssafy.backend.realtime.dto.viewport.ViewportSnapshot;
import com.ssafy.backend.realtime.service.viewport.ViewportService;
import com.ssafy.backend.realtime.service.viewport.ViewportService.OpenResult;
import com.ssafy.backend.realtime.service.viewport.ViewportService.OpenStatus;

/** 화면 요청을 서비스와 개인 큐에 연결하는 흐름을 검증한다. */
@ExtendWith(MockitoExtension.class)
class PresenceWebSocketControllerTests {

	private static final String EMAIL = "user@example.com";
	private static final String SESSION_ID = "session-1";
	private static final Principal PRINCIPAL = () -> EMAIL;

	@Mock PresenceService presenceService;
	@Mock WebSocketSessionService webSocketSessionService;
	@Mock WebSocketErrorService webSocketErrorService;
	@Mock ViewportService viewportService;
	@Mock RealtimeMessageService realtimeMessageService;

	private PresenceWebSocketController controller;

	@BeforeEach
	void setUp() {
		controller = new PresenceWebSocketController(
				presenceService, webSocketSessionService, webSocketErrorService, viewportService, realtimeMessageService);
	}

	@Test
	@DisplayName("현재 화면의 개별 사용자 목록을 개인 큐로 보낸다")
	void sendsIndividualSnapshot() {
		ViewportRequest request = request(3L);
		ViewportRange viewport = request.toViewport();
		ViewportSnapshot snapshot = ViewportSnapshot.individual(3L, 1, List.of());
		when(webSocketSessionService.findEpoch(SESSION_ID)).thenReturn(Optional.of(7L));
		when(viewportService.updateCurrentScreen(EMAIL, 7L, 3L, viewport))
				.thenReturn(new OpenResult(OpenStatus.SNAPSHOT, snapshot));

		controller.viewport(request, PRINCIPAL, SESSION_ID);

		verify(realtimeMessageService).sendToUser(EMAIL, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.VIEWPORT_SNAPSHOT, snapshot);
		verifyNoInteractions(webSocketErrorService);
	}

	@Test
	@DisplayName("잘못된 화면 범위는 개인 오류 큐로 알린다")
	void sendsValidationError() {
		ViewportRequest invalid = new ViewportRequest(
				4L, 1, 3.0, 2.0, 0.0, 1.0, List.of());
		when(webSocketSessionService.findEpoch(SESSION_ID)).thenReturn(Optional.of(7L));

		controller.viewport(invalid, PRINCIPAL, SESSION_ID);

		verify(webSocketErrorService).send(
				EMAIL, WebSocketErrorCode.PRESENCE_VIEWPORT_INVALID, "현재 x 범위가 올바르지 않다");
		verifyNoInteractions(viewportService, realtimeMessageService);
	}

	@Test
	@DisplayName("현재 소켓을 찾지 못하면 서비스 호출 전에 막는다")
	void rejectsMissingSession() {
		when(webSocketSessionService.findEpoch(SESSION_ID)).thenReturn(Optional.empty());

		controller.viewport(request(1L), PRINCIPAL, SESSION_ID);

		verify(webSocketErrorService).send(
				EMAIL, WebSocketErrorCode.PRESENCE_NOT_CONNECTED, "현재 소켓 연결을 찾을 수 없다");
		verifyNoInteractions(viewportService, realtimeMessageService);
	}

	@Test
	@DisplayName("이전 소켓의 요청은 다시 연결하도록 알린다")
	void sendsStaleConnectionError() {
		ViewportRequest request = request(5L);
		when(webSocketSessionService.findEpoch(SESSION_ID)).thenReturn(Optional.of(8L));
		when(viewportService.updateCurrentScreen(EMAIL, 8L, 5L, request.toViewport()))
				.thenReturn(new OpenResult(OpenStatus.STALE_CONNECTION, null));

		controller.viewport(request, PRINCIPAL, SESSION_ID);

		verify(webSocketErrorService).send(
				EMAIL, WebSocketErrorCode.PRESENCE_STALE, "이전 소켓에서 보낸 화면 요청이다");
		verifyNoInteractions(realtimeMessageService);
	}

	@Test
	@DisplayName("늦게 도착한 화면 요청은 응답 없이 무시한다")
	void ignoresOldRequest() {
		ViewportRequest request = request(2L);
		when(webSocketSessionService.findEpoch(SESSION_ID)).thenReturn(Optional.of(7L));
		when(viewportService.updateCurrentScreen(EMAIL, 7L, 2L, request.toViewport()))
				.thenReturn(new OpenResult(OpenStatus.OLD_REQUEST, null));

		controller.viewport(request, PRINCIPAL, SESSION_ID);

		verifyNoInteractions(realtimeMessageService, webSocketErrorService);
	}

	@Test
	@DisplayName("셀별 인원수 화면도 개인 큐로 보낸다")
	void sendsCellCountSnapshot() {
		ViewportRequest request = request(6L);
		ViewportSnapshot snapshot = ViewportSnapshot.clustered(6L, 1, 16, List.of());
		when(webSocketSessionService.findEpoch(SESSION_ID)).thenReturn(Optional.of(7L));
		when(viewportService.updateCurrentScreen(EMAIL, 7L, 6L, request.toViewport()))
				.thenReturn(new OpenResult(OpenStatus.SNAPSHOT, snapshot));

		controller.viewport(request, PRINCIPAL, SESSION_ID);

		verify(realtimeMessageService).sendToUser(
				EMAIL, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.VIEWPORT_SNAPSHOT, snapshot);
		verifyNoInteractions(webSocketErrorService);
	}

	@Test
	@DisplayName("현재 화면의 마지막 요청 순번으로 구독을 닫는다")
	void closesCurrentViewport() {
		when(webSocketSessionService.findEpoch(SESSION_ID)).thenReturn(Optional.of(7L));

		controller.closeViewport(new ViewportCloseRequest(9L), PRINCIPAL, SESSION_ID);

		verify(viewportService).closeCurrentScreen(EMAIL, 7L, 9L);
		verifyNoInteractions(webSocketErrorService, realtimeMessageService);
	}

	@Test
	@DisplayName("잘못된 화면 닫기 순번은 개인 오류 큐로 알린다")
	void rejectsInvalidCloseRequestSequence() {
		when(webSocketSessionService.findEpoch(SESSION_ID)).thenReturn(Optional.of(7L));

		controller.closeViewport(new ViewportCloseRequest(0L), PRINCIPAL, SESSION_ID);

		verify(webSocketErrorService).send(
				EMAIL, WebSocketErrorCode.PRESENCE_VIEWPORT_INVALID, "화면 요청 순번은 1 이상이어야 한다");
		verifyNoInteractions(viewportService, realtimeMessageService);
	}

	@Test
	@DisplayName("화면을 닫을 때 현재 소켓을 찾지 못하면 서비스를 호출하지 않는다")
	void rejectsCloseWithoutSession() {
		when(webSocketSessionService.findEpoch(SESSION_ID)).thenReturn(Optional.empty());

		controller.closeViewport(new ViewportCloseRequest(9L), PRINCIPAL, SESSION_ID);

		verify(webSocketErrorService).send(
				EMAIL, WebSocketErrorCode.PRESENCE_NOT_CONNECTED, "현재 소켓 연결을 찾을 수 없다");
		verifyNoInteractions(viewportService, realtimeMessageService);
	}

	@Test
	@DisplayName("만료된 접속의 하트비트는 다시 연결하도록 알린다")
	void expiredHeartbeatRequestsReconnect() {
		when(presenceService.heartbeat(EMAIL)).thenReturn(false);

		controller.heartbeat(PRINCIPAL);

		verify(webSocketErrorService).send(
				EMAIL, WebSocketErrorCode.PRESENCE_STALE, "접속이 만료됐다. 다시 연결해야 한다");
	}

	@Test
	@DisplayName("재동기화 요청은 새 연결에서 상태를 다시 보내도록 알린다")
	void resyncRequestsExplicitReconnect() {
		controller.resync(PRINCIPAL);

		verify(webSocketErrorService).send(
				EMAIL, WebSocketErrorCode.PRESENCE_STALE, "새 연결 후 입장과 화면 요청을 다시 보내야 한다");
		verifyNoInteractions(viewportService, realtimeMessageService);
	}

	/** 첫 레이어의 정상 화면 요청을 만든다. */
	private static ViewportRequest request(long requestSeq) {
		return new ViewportRequest(requestSeq, 1, 0.0, 2.0, 0.0, 2.0, List.of());
	}
}
