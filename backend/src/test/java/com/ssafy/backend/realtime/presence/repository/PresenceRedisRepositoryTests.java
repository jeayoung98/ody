package com.ssafy.backend.realtime.presence.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

/** 사용자 이탈 스크립트에 주변사람 정리 값을 전달하는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class PresenceRedisRepositoryTests {

	@Mock StringRedisTemplate redis;
	@Mock DefaultRedisScript<List> joinScript;
	@Mock DefaultRedisScript<List> playScript;
	@Mock DefaultRedisScript<List> leaveScript;
	@Mock DefaultRedisScript<Long> recountScript;

	private PresenceRedisRepository repository;

	@BeforeEach
	void setUp() {
		repository = new PresenceRedisRepository(
				redis, joinScript, playScript, leaveScript, recountScript);
	}

	@Test
	@DisplayName("직접 종료는 접속 버전과 주변사람 구독 키를 전달한다")
	void leavePassesEpochAndNearbyKeys() {
		List<String> removed = List.of("20", "2", "3", "4", "7");
		when(redis.execute(leaveScript,
				List.of("presence:user:user@x.com", "presence:expiry", "nearby:meta:user@x.com"),
				"user@x.com", "7", "",
				"listeners:", "layer-listeners:", "active-song:cell:", "active-song:cells:",
				"cell:usercount:", "nearby:subscribers:"))
				.thenReturn(removed);

		assertThat(repository.applyLeave("user@x.com", 7L)).isEqualTo(removed);
		verify(redis).execute(leaveScript,
				List.of("presence:user:user@x.com", "presence:expiry", "nearby:meta:user@x.com"),
				"user@x.com", "7", "",
				"listeners:", "layer-listeners:", "active-song:cell:", "active-song:cells:",
				"cell:usercount:", "nearby:subscribers:");
	}

	@Test
	@DisplayName("만료 종료는 확인 시각과 주변사람 구독 키를 전달한다")
	void expiredLeavePassesTimeAndNearbyKeys() {
		List<String> removed = List.of("20", "2", "3", "4", "7");
		when(redis.execute(leaveScript,
				List.of("presence:user:user@x.com", "presence:expiry", "nearby:meta:user@x.com"),
				"user@x.com", "", "1000",
				"listeners:", "layer-listeners:", "active-song:cell:", "active-song:cells:",
				"cell:usercount:", "nearby:subscribers:"))
				.thenReturn(removed);

		assertThat(repository.applyLeaveExpired("user@x.com", 1000L)).isEqualTo(removed);
		verify(redis).execute(leaveScript,
				List.of("presence:user:user@x.com", "presence:expiry", "nearby:meta:user@x.com"),
				"user@x.com", "", "1000",
				"listeners:", "layer-listeners:", "active-song:cell:", "active-song:cells:",
				"cell:usercount:", "nearby:subscribers:");
	}
}
