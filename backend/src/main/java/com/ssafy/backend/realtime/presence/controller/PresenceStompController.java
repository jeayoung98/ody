package com.ssafy.backend.realtime.presence.controller;

import java.security.Principal;

import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import org.springframework.context.annotation.Profile;

import com.ssafy.backend.realtime.error.RealtimeWsErrorCode;
import com.ssafy.backend.realtime.error.RealtimeWsErrorSender;
import com.ssafy.backend.realtime.presence.dto.JoinRequest;
import com.ssafy.backend.realtime.presence.dto.ViewportRequest;
import com.ssafy.backend.realtime.presence.service.PresenceLifecycleService;
import com.ssafy.backend.realtime.session.WebSocketSessionRegistry;

import lombok.RequiredArgsConstructor;

/**
 * C→S: join · heartbeat · leave · viewport · resync
 * 검증 실패는 /user/queue/errors 로 회신(FR-042) — 검증 배선은 후속.
 */
@Controller
@Profile("realtime")
@RequiredArgsConstructor
public class PresenceStompController {

	private final PresenceLifecycleService lifecycleService;
	private final WebSocketSessionRegistry sessionRegistry;
	private final RealtimeWsErrorSender errorSender;

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

	/** 화면 인원수 확인용 — 스냅샷·구독(RT-20~23). 이번 범위 밖. */
	@MessageMapping("/presence/viewport")
	public void viewport(ViewportRequest request, Principal principal) {
		// TODO(RT-22): ViewportService — 스냅샷·구독
	}

	/** 재동기화 — 현재 viewport·nearby 기준 스냅샷 재발급(FR-004, RT-22). 이번 범위 밖. */
	@MessageMapping("/presence/resync")
	public void resync(Principal principal) {
		// TODO(RT-22): 스냅샷 재발급
	}
}
