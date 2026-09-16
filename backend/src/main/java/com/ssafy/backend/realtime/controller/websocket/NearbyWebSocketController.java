package com.ssafy.backend.realtime.controller.websocket;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;
import com.ssafy.backend.realtime.session.WebSocketSessionService;

import lombok.RequiredArgsConstructor;

/** 주변사람 패널 닫기 소켓 요청을 받는다. */
@Controller
@Profile("realtime")
@RequiredArgsConstructor
public class NearbyWebSocketController {

	private final NearbyPeopleService nearbyPeopleService; // 주변사람 구독 관리
	private final WebSocketSessionService webSocketSessionService; // 세션의 접속 버전

	/**
	 * 현재 소켓이 열은 주변사람 구독을 닫는다.
	 *
	 * @param principal 로그인한 사용자
	 * @param sessionId 소켓 세션 ID
	 */
	@MessageMapping("/nearby/close")
	public void close(Principal principal, @Header("simpSessionId") String sessionId) {
		webSocketSessionService.findEpoch(sessionId)
				.ifPresent(epoch -> nearbyPeopleService.close(principal.getName(), epoch));
	}
}
