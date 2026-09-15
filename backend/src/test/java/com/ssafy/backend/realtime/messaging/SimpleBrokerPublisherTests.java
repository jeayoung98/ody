package com.ssafy.backend.realtime.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.ssafy.backend.realtime.session.WebSocketSessionRegistry;

/** 개인 큐 발행 시 seq와 공통 실시간 봉투를 붙이는지 검증한다. */
class SimpleBrokerPublisherTests {

	@Test
	@DisplayName("사용자 seq를 발급해 공통 봉투로 개인 큐에 보낸다")
	void publishesEnvelopeToUserQueue() {
		SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
		WebSocketSessionRegistry sessionRegistry = mock(WebSocketSessionRegistry.class);
		SimpleBrokerPublisher publisher = new SimpleBrokerPublisher(messagingTemplate, sessionRegistry);
		Map<String, Object> payload = Map.of("nickname", "nearby-user");
		when(sessionRegistry.nextSeq("receiver@x.com")).thenReturn(7L);

		publisher.publishToUser("receiver@x.com", RealtimeDestination.QUEUE_PRESENCE,
				RealtimeEventType.NEARBY_ENTER, payload);

		ArgumentCaptor<RealtimeEnvelope> envelopeCaptor = ArgumentCaptor.forClass(RealtimeEnvelope.class);
		verify(messagingTemplate).convertAndSendToUser(
				eq("receiver@x.com"), eq(RealtimeDestination.QUEUE_PRESENCE), envelopeCaptor.capture());
		RealtimeEnvelope<?> envelope = envelopeCaptor.getValue();
		assertThat(envelope.type()).isEqualTo(RealtimeEventType.NEARBY_ENTER);
		assertThat(envelope.seq()).isEqualTo(7L);
		assertThat(envelope.ts()).isPositive();
		assertThat(envelope.payload()).isEqualTo(payload);
	}
}
