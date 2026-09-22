package com.ssafy.backend.realtime.service.presence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;

/** 접속 여부를 접속 정보에서 그대로 읽어 오는지 확인한다. */
@ExtendWith(MockitoExtension.class)
class RedisOnlineStatusServiceTests {

	private static final String EMAIL = "a@example.com";

	@Mock PresenceRedisRepository presenceRedisRepository;
	@InjectMocks RedisOnlineStatusService service;

	@Test
	@DisplayName("접속 정보가 있으면 접속 중이다")
	void onlineWhenPresenceExists() {
		given(presenceRedisRepository.isConnected(EMAIL)).willReturn(true);

		assertThat(service.isOnline(EMAIL)).isTrue();
	}

	@Test
	@DisplayName("여러 명은 한 번에 묶어 묻는다")
	void asksManyAtOnce() {
		List<String> emails = List.of(EMAIL, "b@example.com");
		given(presenceRedisRepository.connectedOf(emails)).willReturn(Map.of(EMAIL, true));

		assertThat(service.onlineOf(emails)).containsExactly(Map.entry(EMAIL, true));
	}
}
