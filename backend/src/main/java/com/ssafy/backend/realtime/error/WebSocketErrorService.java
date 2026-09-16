package com.ssafy.backend.realtime.error;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.RealtimeMessageService;

import lombok.RequiredArgsConstructor;

/**
 * /user/queue/errors 전송 헬퍼 (FR-042). WS 처리 중 검증 실패를 개인 큐로 알린다.
 */
@Component
@RequiredArgsConstructor
public class WebSocketErrorService {

	private final RealtimeMessageService realtimeMessageService;

	public void send(String userId, WebSocketErrorCode code, String message) {
		realtimeMessageService.sendToUser(userId, WebSocketDestination.QUEUE_ERRORS,
				RealtimeMessageType.PRESENCE_ERROR, Map.of("code", code.name(), "message", message));
	}
}
