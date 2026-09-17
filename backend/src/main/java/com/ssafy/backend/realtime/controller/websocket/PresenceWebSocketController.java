package com.ssafy.backend.realtime.controller.websocket;

import java.security.Principal;

import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import org.springframework.context.annotation.Profile;

import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorService;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.dto.presence.JoinRequest;
import com.ssafy.backend.realtime.dto.presence.ViewportCloseRequest;
import com.ssafy.backend.realtime.dto.presence.ViewportRequest;
import com.ssafy.backend.realtime.service.presence.PresenceService;
import com.ssafy.backend.realtime.session.WebSocketSessionService;
import com.ssafy.backend.realtime.service.viewport.ViewportService;
import com.ssafy.backend.realtime.service.viewport.ViewportService.OpenResult;
import com.ssafy.backend.realtime.service.viewport.ViewportService.OpenStatus;

import lombok.RequiredArgsConstructor;

/**
 * C→S: join · heartbeat · leave · viewport · resync
 * 잘못된 요청은 /user/queue/errors 로 알린다.
 */
@Controller
@Profile("realtime")
@RequiredArgsConstructor
public class PresenceWebSocketController {

	private final PresenceService presenceService; // 입장·접속 유지·종료 처리
	private final WebSocketSessionService webSocketSessionService; // 현재 소켓의 접속 번호 조회
	private final WebSocketErrorService webSocketErrorService; // 개인 오류 큐로 전송
	private final ViewportService viewportService; // 현재 화면의 사용자 목록 생성
	private final RealtimeMessageService realtimeMessageService; // 개인 큐로 목록 전송

	/** 입장(배치·복원). 활성 진입 아님 — 만남·이동은 /music/play 에서. */
	@MessageMapping("/presence/join")
	public void join(JoinRequest request, Principal principal) {
		presenceService.join(principal.getName(), request);
	}

	/** 아직 접속 중임 증명 — 만료 시각 갱신. */
	@MessageMapping("/presence/heartbeat")
	public void heartbeat(Principal principal) {
		boolean alive = presenceService.heartbeat(principal.getName());
		if (!alive) {
			webSocketErrorService.send(principal.getName(), WebSocketErrorCode.PRESENCE_STALE,
					"접속이 만료됐다. 다시 연결해야 한다");
		}
	}

	/** 명시적 종료 — 그 세션의 epoch 로 정리(세션 제거는 DISCONNECT 가 담당). */
	@MessageMapping("/presence/leave")
	public void leave(Principal principal, @Header("simpSessionId") String sessionId) {
		webSocketSessionService.findEpoch(sessionId)
				.ifPresent(epoch -> presenceService.leave(principal.getName(), epoch));
	}

	/**
	 * 현재 화면을 구독하고 개별 사용자 목록을 보낸다.
	 *
	 * @param request 화면 범위와 요청 순번
	 * @param principal 로그인한 사용자
	 * @param sessionId 현재 소켓 세션 ID
	 */
	@MessageMapping("/presence/viewport")
	public void viewport(
			ViewportRequest request,
			Principal principal,
			@Header("simpSessionId") String sessionId) {
		String email = principal.getName();

		// 1. 현재 소켓의 접속 번호를 찾는다.
		Long epoch = webSocketSessionService.findEpoch(sessionId).orElse(null);
		if (epoch == null) {
			webSocketErrorService.send(email, WebSocketErrorCode.PRESENCE_NOT_CONNECTED, "현재 소켓 연결을 찾을 수 없다");
			return;
		}

		try {
			// 2. 요청값을 검사하고 현재 화면의 사용자 목록을 만든다.
			if (request == null) {
				throw new IllegalArgumentException("화면 요청이 비어 있다");
			}
			ViewportRange viewport = request.toViewport();
			OpenResult result = viewportService.updateCurrentScreen(
					email, epoch, request.requestSeq(), viewport);

			// 3. 현재 화면 정보가 완성되면 개인 큐로 보낸다.
			if (result.status() == OpenStatus.SNAPSHOT) {
				realtimeMessageService.sendToUser(email, WebSocketDestination.QUEUE_PRESENCE,
						RealtimeMessageType.VIEWPORT_SNAPSHOT, result.snapshot());
				return;
			}
			if (result.status() == OpenStatus.STALE_CONNECTION) {
				webSocketErrorService.send(email, WebSocketErrorCode.PRESENCE_STALE, "이전 소켓에서 보낸 화면 요청이다");
			}
			// 오래된 화면 요청은 무시한다.
		} catch (IllegalArgumentException e) {
			webSocketErrorService.send(email, WebSocketErrorCode.PRESENCE_VIEWPORT_INVALID, e.getMessage());
		}
	}

	/**
	 * 현재 소켓에서 마지막으로 연 화면의 구독을 닫는다.
	 *
	 * @param request 마지막 화면 요청 순번
	 * @param principal 로그인한 사용자
	 * @param sessionId 현재 소켓 세션 ID
	 */
	@MessageMapping("/presence/viewport/close")
	public void closeViewport(
			ViewportCloseRequest request,
			Principal principal,
			@Header("simpSessionId") String sessionId) {
		String email = principal.getName();
		Long epoch = webSocketSessionService.findEpoch(sessionId).orElse(null);
		if (epoch == null) {
			webSocketErrorService.send(email, WebSocketErrorCode.PRESENCE_NOT_CONNECTED, "현재 소켓 연결을 찾을 수 없다");
			return;
		}

		try {
			if (request == null) {
				throw new IllegalArgumentException("화면 닫기 요청이 비어 있다");
			}
			viewportService.closeCurrentScreen(email, epoch, request.validatedRequestSeq());
		} catch (IllegalArgumentException e) {
			webSocketErrorService.send(email, WebSocketErrorCode.PRESENCE_VIEWPORT_INVALID, e.getMessage());
		}
	}

	/**
	 * 자동 복원 대신 새 소켓에서 상태를 다시 보내도록 알린다.
	 *
	 * @param principal 로그인한 사용자
	 */
	@MessageMapping("/presence/resync")
	public void resync(Principal principal) {
		webSocketErrorService.send(principal.getName(), WebSocketErrorCode.PRESENCE_STALE,
				"새 연결 후 입장과 화면 요청을 다시 보내야 한다");
	}
}
