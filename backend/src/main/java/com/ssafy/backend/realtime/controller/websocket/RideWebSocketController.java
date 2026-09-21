package com.ssafy.backend.realtime.controller.websocket;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import com.ssafy.backend.realtime.dto.ride.RidePanelRequest;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackRequest;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorService;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.service.ride.RidePanelService;
import com.ssafy.backend.realtime.service.ride.RidePlaybackService;
import com.ssafy.backend.realtime.session.WebSocketSessionService;

import lombok.RequiredArgsConstructor;

/**
 * 인솔자의 재생 조작과 곡 상세 조작을 받아 따라오는 사람들에게 넘긴다.
 * 너무 잦은 발송을 막는 일과 어긋남을 알아채는 일은 프론트가 하고, 서버는 받는 대로 넘기기만 한다.
 */
@Controller
@Profile("realtime")
@RequiredArgsConstructor
public class RideWebSocketController {

	private final RidePlaybackService ridePlaybackService; // 재생 정보 저장과 발송
	private final RidePanelService ridePanelService; // 곡 상세 저장과 발송
	private final WebSocketSessionService webSocketSessionService; // 현재 소켓의 접속 번호 조회
	private final WebSocketErrorService webSocketErrorService; // 개인 오류 큐로 전송

	/**
	 * 인솔자가 재생·정지·구간 이동을 했을 때 받는다.
	 *
	 * @param request 조작 종류와 그때의 재생 위치
	 * @param principal 로그인한 사용자
	 * @param sessionId 현재 소켓 세션 ID
	 */
	@MessageMapping(WebSocketDestination.APP_RIDE_PLAYBACK)
	public void playback(
			RidePlaybackRequest request,
			Principal principal,
			@Header("simpSessionId") String sessionId) {
		String email = principal.getName();
		if (notConnected(email, sessionId)) {
			return;
		}

		try {
			if (request == null) {
				throw new IllegalArgumentException("재생 조작 요청이 비어 있다");
			}
			ridePlaybackService.relay(email, request);
		} catch (WebSocketRequestException e) {
			webSocketErrorService.send(email, e.getCode(), e.getMessage());
		} catch (IllegalArgumentException e) {
			webSocketErrorService.send(email, WebSocketErrorCode.RIDE_PLAYBACK_INVALID, e.getMessage());
		}
	}

	/**
	 * 인솔자가 곡 상세를 열거나 닫거나 탭을 바꿨을 때 받는다.
	 *
	 * @param request 열었는지 닫았는지와 곡·탭
	 * @param principal 로그인한 사용자
	 * @param sessionId 현재 소켓 세션 ID
	 */
	@MessageMapping(WebSocketDestination.APP_RIDE_PANEL)
	public void panel(
			RidePanelRequest request,
			Principal principal,
			@Header("simpSessionId") String sessionId) {
		String email = principal.getName();
		if (notConnected(email, sessionId)) {
			return;
		}

		try {
			if (request == null) {
				throw new IllegalArgumentException("곡 상세 요청이 비어 있다");
			}
			ridePanelService.relay(email, request);
		} catch (WebSocketRequestException e) {
			webSocketErrorService.send(email, e.getCode(), e.getMessage());
		} catch (IllegalArgumentException e) {
			webSocketErrorService.send(email, WebSocketErrorCode.RIDE_PANEL_INVALID, e.getMessage());
		}
	}

	/**
	 * 등록되지 않은 소켓에서 온 요청인지 확인하고, 그러면 오류를 보낸다.
	 *
	 * @return 받지 말아야 할 요청이면 true
	 */
	private boolean notConnected(String email, String sessionId) {
		if (webSocketSessionService.findEpoch(sessionId).isPresent()) {
			return false;
		}
		webSocketErrorService.send(email, WebSocketErrorCode.PRESENCE_NOT_CONNECTED,
				"현재 소켓 연결을 찾을 수 없다");
		return true;
	}
}
