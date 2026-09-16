package com.ssafy.backend.realtime.repository.redis;

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

/** 주변사람 구독 스크립트에 전달하는 값을 검증한다. */
@ExtendWith(MockitoExtension.class)
class NearbyRedisRepositoryTests {

	@Mock StringRedisTemplate redis;
	@Mock DefaultRedisScript<Long> replaceScript;
	@Mock DefaultRedisScript<Long> closeScript;

	private NearbyRedisRepository repository;

	@BeforeEach
	void setUp() {
		repository = new NearbyRedisRepository(redis, replaceScript, closeScript);
	}

	@Test
	@DisplayName("구독 교체는 현재 상태와 구독 정보 키를 함께 전달한다")
	void replaceSubscriptionsPassesKeysAndValues() {
		when(redis.execute(replaceScript,
				List.of("presence:user:user@x.com", "nearby:meta:user@x.com"),
				"user@x.com", "7", "nearby:subscribers:", "10,20"))
				.thenReturn(1L);

		boolean replaced = repository.replaceSubscriptions("user@x.com", 7L, List.of(10L, 20L));

		assertThat(replaced).isTrue();
		verify(redis).execute(replaceScript,
				List.of("presence:user:user@x.com", "nearby:meta:user@x.com"),
				"user@x.com", "7", "nearby:subscribers:", "10,20");
	}

	@Test
	@DisplayName("구독 닫기는 접속 버전과 구독 정보 키를 전달한다")
	void closeSubscriptionsPassesEpochAndKey() {
		when(redis.execute(closeScript,
				List.of("nearby:meta:user@x.com"),
				"user@x.com", "7", "nearby:subscribers:"))
				.thenReturn(1L);

		boolean closed = repository.closeSubscriptions("user@x.com", 7L);

		assertThat(closed).isTrue();
		verify(redis).execute(closeScript,
				List.of("nearby:meta:user@x.com"),
				"user@x.com", "7", "nearby:subscribers:");
	}
}
