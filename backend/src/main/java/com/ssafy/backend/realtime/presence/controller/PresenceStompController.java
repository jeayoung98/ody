package com.ssafy.backend.realtime.presence.controller;

import java.security.Principal;

import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import org.springframework.context.annotation.Profile;

import com.ssafy.backend.realtime.error.RealtimeWsErrorCode;
import com.ssafy.backend.realtime.error.RealtimeWsErrorSender;
import com.ssafy.backend.realtime.geometry.Viewport;
import com.ssafy.backend.realtime.messaging.RealtimeDestination;
import com.ssafy.backend.realtime.messaging.RealtimeEventType;
import com.ssafy.backend.realtime.messaging.RealtimePublisher;
import com.ssafy.backend.realtime.presence.dto.JoinRequest;
import com.ssafy.backend.realtime.presence.dto.ViewportRequest;
import com.ssafy.backend.realtime.presence.service.PresenceLifecycleService;
import com.ssafy.backend.realtime.session.WebSocketSessionRegistry;
import com.ssafy.backend.realtime.viewport.service.ViewportService;
import com.ssafy.backend.realtime.viewport.service.ViewportService.OpenResult;
import com.ssafy.backend.realtime.viewport.service.ViewportService.OpenStatus;

import lombok.RequiredArgsConstructor;

/**
 * C→S: join · heartbeat · leave · viewport · resync
 * 잘못된 요청은 /user/queue/errors 로 알린다.
 */
@Controller
@Profile("realtime")
@RequiredArgsConstructor
public class PresenceStompController {

	private final PresenceLifecycleService lifecycleService; // 입장·접속 유지·종료 처리
	private final WebSocketSessionRegistry sessionRegistry; // 현재 소켓의 접속 번호 조회
	private final RealtimeWsErrorSender errorSender; // 개인 오류 큐로 전송
	private final ViewportService viewportService; // 현재 화면의 사용자 목록 생성
	private final RealtimePublisher publisher; // 개인 큐로 목록 전송

	/** 입장(배치·복원). 활성 진입 아님 — 만남·이동은 /music/play 에서. */
	@MessageMapping("/presence/join")
	public void join(JoinRequest request, Principal principal) {
		lifecycleService.join(principal.getName(), request);
	}

	/** 아직 접속 중임 증명 — 만료 시각 갱신. */
	@MessageMapping("/presence/heartbeat")
	public void heartbeat(Principal principal) {
		boolean alive = lifecycleService.heartbeat(principal.getName());
		if (!alive) {
			// 이미 sweep 돼 만료큐에서 빠짐 → 클라는 살아있다 오해. STALE 회신해 resync 유도(P3-f).
			errorSender.send(principal.getName(), RealtimeWsErrorCode.PRESENCE_STALE,
					"presence expired, resync required");
		}
	}

	/** 명시적 종료 — 그 세션의 epoch 로 정리(세션 제거는 DISCONNECT 가 담당). */
	@MessageMapping("/presence/leave")
	public void leave(Principal principal, @Header("simpSessionId") String sessionId) {
		sessionRegistry.epochOf(sessionId)
				.ifPresent(epoch -> lifecycleService.leave(principal.getName(), epoch));
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
		Long epoch = sessionRegistry.epochOf(sessionId).orElse(null);
		if (epoch == null) {
			errorSender.send(email, RealtimeWsErrorCode.PRESENCE_NOT_CONNECTED, "현재 소켓 연결을 찾을 수 없다");
			return;
		}

		try {
			// 2. 요청값을 검사하고 현재 화면의 사용자 목록을 만든다.
			if (request == null) {
				throw new IllegalArgumentException("화면 요청이 비어 있다");
			}
			Viewport viewport = request.toViewport();
			OpenResult result = viewportService.open(
					email, epoch, request.requestSeq(), viewport);

			// 3. 개별 사용자 목록이 완성되면 개인 큐로 보낸다.
			if (result.status() == OpenStatus.SNAPSHOT) {
				publisher.publishToUser(email, RealtimeDestination.QUEUE_PRESENCE,
						RealtimeEventType.VIEWPORT_SNAPSHOT, result.snapshot());
				return;
			}
			if (result.status() == OpenStatus.STALE_CONNECTION) {
				errorSender.send(email, RealtimeWsErrorCode.PRESENCE_STALE, "이전 소켓에서 보낸 화면 요청이다");
			}
			// 오래된 화면 요청은 무시한다. CLUSTERED 응답은 S15P21A405-141에서 연결한다.
		} catch (IllegalArgumentException e) {
			errorSender.send(email, RealtimeWsErrorCode.PRESENCE_VIEWPORT_INVALID, e.getMessage());
		}
	}

	/** 재동기화 — 현재 viewport·nearby 기준 스냅샷 재발급(FR-004, RT-22). 이번 범위 밖. */
	@MessageMapping("/presence/resync")
	public void resync(Principal principal) {
		// TODO(RT-22): 스냅샷 재발급
	}
}
