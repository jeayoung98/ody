package com.ssafy.backend.realtime.presence.controller;

import java.security.Principal;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import com.ssafy.backend.realtime.common.RealtimeErrorSender;
import com.ssafy.backend.realtime.presence.dto.JoinRequest;
import com.ssafy.backend.realtime.presence.dto.ViewportRequest;
import com.ssafy.backend.realtime.presence.service.PresenceLifecycleService;

import lombok.RequiredArgsConstructor;

/**
 * C→S: join · heartbeat · leave · viewport · resync
 * 검증 실패는 /user/queue/errors 로 회신(FR-042).
 */
@Controller
@RequiredArgsConstructor
public class PresenceStompController {

	private final PresenceLifecycleService lifecycleService;
	private final RealtimeErrorSender errorSender;

	/**
	 * 첫 접속(입장)
	 * @param request
	 * @param principal
	 */
	@MessageMapping("/presence/join")
	public void join(JoinRequest request, Principal principal) {
		// TODO(내부작업): lifecycleService.join(principal.getName(), request)
	}

	/**
	 * 아직 남아있음 증명 :
	 * @param principal
	 */
	@MessageMapping("/presence/heartbeat")
	public void heartbeat(Principal principal) {
		// TODO(내부작업): lifecycleService.heartbeat(principal.getName())
	}

	/**
	 * 종료
	 * @param principal
	 */
	@MessageMapping("/presence/leave")
	public void leave(Principal principal) {
		// TODO(내부작업): lifecycleService.leave(principal.getName(), epoch)
	}

	/**
	 * 현재 보고있는 화면에서 몇명있는지 확인용
	 * @param request
	 * @param principal
	 */
	@MessageMapping("/presence/viewport")
	public void viewport(ViewportRequest request, Principal principal) {
		// TODO(내부작업): ViewportService — 스냅샷·구독(RT-20~23)
	}

	/**
	 * 갑자기 종료되었을때 싱크 맞추기
	 * @param principal
	 */
	@MessageMapping("/presence/resync")
	public void resync(Principal principal) {
		// TODO(내부작업): 현재 viewport·nearby 상태 기준 스냅샷 재발급(FR-004)
	}
}
