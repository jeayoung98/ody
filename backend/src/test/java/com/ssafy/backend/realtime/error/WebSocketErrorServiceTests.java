package com.ssafy.backend.realtime.error;

import static org.mockito.Mockito.verify;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;

/** 개인 오류 큐의 요청 정보 전달을 검증한다. */
@ExtendWith(MockitoExtension.class)
class WebSocketErrorServiceTests {

	@Mock RealtimeMessageService realtimeMessageService;
	@InjectMocks WebSocketErrorService service;

	@Test
	@DisplayName("입장 오류에는 프론트 요청 순번을 함께 보낸다")
	void sendsRequestSequence() {
		service.send("user@example.com", WebSocketErrorCode.PRESENCE_STALE, "이전 요청이다", 8L);

		verify(realtimeMessageService).sendToUser(
				"user@example.com", WebSocketDestination.QUEUE_ERRORS,
				RealtimeMessageType.PRESENCE_ERROR,
				Map.of("code", "PRESENCE_STALE", "message", "이전 요청이다", "requestSeq", 8L));
	}
}
