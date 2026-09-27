package com.ssafy.backend.realtime.controller.websocket;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import com.ssafy.backend.realtime.error.WebSocketErrorService;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;
import com.ssafy.backend.realtime.service.ride.RideGuard;
import com.ssafy.backend.realtime.session.WebSocketSessionService;

import lombok.RequiredArgsConstructor;

/** 주변사람 패널 닫기 소켓 요청을 받는다. */
@Controller
@Profile("realtime")
@RequiredArgsConstructor
public class NearbyWebSocketController {

	private final NearbyPeopleService nearbyPeopleService; // 주변사람 구독 관리
	private final WebSocketSessionService webSocketSessionService; // 세션의 접속 버전
	private final RideGuard rideGuard; // 따라가는 중에는 스스로 조작하지 못하게 막는다
	private final WebSocketErrorService webSocketErrorService; // 개인 오류 큐로 전송

	/**
	 * 현재 소켓이 열은 주변사람 구독을 닫는다.
	 *
	 * @param principal 로그인한 사용자
	 * @param sessionId 소켓 세션 ID
	 */
	@MessageMapping("/nearby/close")
	public void close(Principal principal, @Header("simpSessionId") String sessionId) {
		String email = principal.getName();
		try {
			// 탑승할 때 이미 닫았다. 따라가는 동안은 주변사람을 스스로 열 수도 닫을 수도 없다.
			rideGuard.requireNotRiding(email, "주변 사람을 닫을");
		} catch (WebSocketRequestException e) {
			webSocketErrorService.send(email, e.getCode(), e.getMessage());
			return;
		}
		webSocketSessionService.findEpoch(sessionId)
				.ifPresent(epoch -> nearbyPeopleService.close(email, epoch));
	}
}
