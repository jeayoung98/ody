package com.ssafy.backend.realtime.common;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.ssafy.backend.realtime.common.RealtimeErrorCode.WsCode;

import lombok.RequiredArgsConstructor;

/**
 * /user/queue/errors 전송 헬퍼 (FR-042). WS 처리 중 검증 실패를 개인 큐로 알린다.
 */
@Component
@RequiredArgsConstructor
public class RealtimeErrorSender {

	private final RealtimePublisher publisher;

	public void send(String userId, WsCode code, String message) {
		publisher.publishToUser(userId, RealtimeDestination.QUEUE_ERRORS,
				RealtimeEventType.PRESENCE_ERROR, Map.of("code", code.name(), "message", message));
	}
}
