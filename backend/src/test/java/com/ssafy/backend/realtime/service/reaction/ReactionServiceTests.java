package com.ssafy.backend.realtime.service.reaction;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.dto.reaction.ReactionPayload;
import com.ssafy.backend.realtime.dto.reaction.ReactionRequest;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;

/** 같은 층의 사람에게만, 쿨다운 안에 한 번만 반응이 가는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class ReactionServiceTests {

	private static final String ME = "me@x.com";
	private static final String YOU = "you@x.com";

	@Mock PresenceRedisRepository presenceRedisRepository;
	@Mock RealtimeMessageService realtimeMessageService;
	@Mock StringRedisTemplate redis;
	@Mock ValueOperations<String, String> valueOps;
	@InjectMocks ReactionService service;

	@Test
	@DisplayName("같은 층이면 받는 사람 개인 큐로 REACTION 이 나간다")
	void sendsToSameLayer() {
		when(redis.opsForValue()).thenReturn(valueOps);
		when(presenceRedisRepository.currentLayer(ME)).thenReturn(2L);
		when(presenceRedisRepository.currentLayer(YOU)).thenReturn(2L);
		when(valueOps.setIfAbsent(eq("reaction-cd:" + ME + ":" + YOU), eq("1"), any(Duration.class)))
				.thenReturn(true);

		service.send(ME, new ReactionRequest(YOU, "fire"));

		ArgumentCaptor<ReactionPayload> payload = ArgumentCaptor.forClass(ReactionPayload.class);
		verify(realtimeMessageService).sendToUser(eq(YOU), eq(WebSocketDestination.QUEUE_PRESENCE),
				eq(RealtimeMessageType.REACTION), payload.capture());
		org.assertj.core.api.Assertions.assertThat(payload.getValue().fromEmail()).isEqualTo(ME);
		org.assertj.core.api.Assertions.assertThat(payload.getValue().reactionKey()).isEqualTo("fire");
		org.assertj.core.api.Assertions.assertThat(payload.getValue().sentAt()).isNotBlank();
	}

	@Test
	@DisplayName("다른 층이면 REACTION_NOT_NEARBY 로 거부하고 보내지 않는다")
	void rejectsDifferentLayer() {
		when(presenceRedisRepository.currentLayer(ME)).thenReturn(2L);
		when(presenceRedisRepository.currentLayer(YOU)).thenReturn(3L);

		assertThatThrownBy(() -> service.send(ME, new ReactionRequest(YOU, "fire")))
				.isInstanceOf(CustomException.class)
				.extracting("errorCode").isEqualTo(RealtimeErrorCode.REACTION_NOT_NEARBY);
		verifyNoInteractions(realtimeMessageService);
	}

	@Test
	@DisplayName("상대가 접속 중이 아니면 REACTION_NOT_NEARBY 로 거부한다")
	void rejectsOfflineTarget() {
		when(presenceRedisRepository.currentLayer(ME)).thenReturn(2L);
		when(presenceRedisRepository.currentLayer(YOU)).thenReturn(null);

		assertThatThrownBy(() -> service.send(ME, new ReactionRequest(YOU, "fire")))
				.isInstanceOf(CustomException.class)
				.extracting("errorCode").isEqualTo(RealtimeErrorCode.REACTION_NOT_NEARBY);
	}

	@Test
	@DisplayName("내가 층 위에 없으면 PRESENCE_ERROR 로 거부한다 — 재연결로 풀 문제다")
	void rejectsUnplacedSender() {
		when(presenceRedisRepository.currentLayer(ME)).thenReturn(null);

		assertThatThrownBy(() -> service.send(ME, new ReactionRequest(YOU, "fire")))
				.isInstanceOf(CustomException.class)
				.extracting("errorCode").isEqualTo(RealtimeErrorCode.PRESENCE_ERROR);
	}

	@Test
	@DisplayName("쿨다운 안에 같은 사람에게 다시 보내면 REACTION_COOLDOWN 으로 거부한다")
	void rejectsWithinCooldown() {
		when(redis.opsForValue()).thenReturn(valueOps);
		when(presenceRedisRepository.currentLayer(anyString())).thenReturn(2L);
		when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);

		assertThatThrownBy(() -> service.send(ME, new ReactionRequest(YOU, "fire")))
				.isInstanceOf(CustomException.class)
				.extracting("errorCode").isEqualTo(RealtimeErrorCode.REACTION_COOLDOWN);
		verifyNoInteractions(realtimeMessageService);
	}

	@Test
	@DisplayName("자기 자신에게는 REACTION_SELF 로 거부하고 Redis 도 보지 않는다")
	void rejectsSelf() {
		assertThatThrownBy(() -> service.send(ME, new ReactionRequest(ME, "fire")))
				.isInstanceOf(CustomException.class)
				.extracting("errorCode").isEqualTo(RealtimeErrorCode.REACTION_SELF);
		verifyNoInteractions(presenceRedisRepository, realtimeMessageService);
	}
}
