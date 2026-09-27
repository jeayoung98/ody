package com.ssafy.backend.realtime.repository.redis.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import com.ssafy.backend.realtime.repository.mapper.MeetingMapper;
import com.ssafy.backend.realtime.service.meeting.MeetingService;

/** 실제 Redis에서 만남 쿨다운을 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class MeetingRedisIntegrationTests {

	private static LettuceConnectionFactory connectionFactory;
	private static StringRedisTemplate redis;

	private final Set<String> keysToDelete = new LinkedHashSet<>();
	private MeetingMapper meetingMapper;
	private MeetingService meetingService;

	@BeforeAll
	static void connectRedis() {
		String host = env("REDIS_TEST_HOST", "127.0.0.1");
		int port = Integer.parseInt(env("REDIS_TEST_PORT", "6380"));

		RedisStandaloneConfiguration server = new RedisStandaloneConfiguration(host, port);
		String password = System.getenv("REDIS_TEST_PASSWORD");
		if (password != null && !password.isBlank()) {
			server.setPassword(password);
		}

		LettuceClientConfiguration client = LettuceClientConfiguration.builder()
				.commandTimeout(Duration.ofSeconds(2))
				.shutdownTimeout(Duration.ZERO)
				.build();
		connectionFactory = new LettuceConnectionFactory(server, client);
		connectionFactory.afterPropertiesSet();

		redis = new StringRedisTemplate(connectionFactory);
		redis.afterPropertiesSet();
		assertThat(connectionFactory.getConnection().ping()).isEqualTo("PONG");
	}

	@BeforeEach
	void setUp() {
		meetingMapper = mock(MeetingMapper.class);
		meetingService = new MeetingService(meetingMapper, redis);
		ReflectionTestUtils.setField(meetingService, "cooldownSec", 180L);
	}

	@AfterEach
	void cleanKeys() {
		if (!keysToDelete.isEmpty()) {
			redis.delete(keysToDelete);
		}
	}

	@AfterAll
	static void disconnectRedis() {
		if (connectionFactory != null) {
			connectionFactory.destroy();
		}
	}

	@Test
	@DisplayName("같은 사용자 쌍은 순서가 바뀌어도 한 번만 기록한다")
	void samePairUsesOneCooldownKey() {
		String first = email("a");
		String second = email("z");
		String cooldownKey = key(first, second);

		meetingService.recordMeetings(second, List.of(first));
		meetingService.recordMeetings(first, List.of(second));

		verify(meetingMapper, times(1)).upsertIncrement(first, second);
		assertThat(redis.opsForValue().get(cooldownKey)).isEqualTo("1");
		assertThat(redis.getExpire(cooldownKey)).isBetween(1L, 180L);
	}

	@Test
	@DisplayName("쿨다운이 끝나면 같은 사용자 쌍을 다시 기록한다")
	void expiredCooldownAllowsNextMeeting() throws InterruptedException {
		String first = email("a");
		String second = email("b");
		String cooldownKey = key(first, second);
		ReflectionTestUtils.setField(meetingService, "cooldownSec", 1L);

		meetingService.recordMeetings(first, List.of(second));
		waitUntilDeleted(cooldownKey);
		meetingService.recordMeetings(first, List.of(second));

		verify(meetingMapper, times(2)).upsertIncrement(first, second);
		assertThat(redis.opsForValue().get(cooldownKey)).isEqualTo("1");
	}

	@Test
	@DisplayName("서로 다른 사용자 쌍은 각각 쿨다운을 만든다")
	void differentPairsUseSeparateCooldownKeys() {
		String actor = email("a");
		String first = email("b");
		String second = email("c");
		String firstKey = key(actor, first);
		String secondKey = key(actor, second);

		meetingService.recordMeetings(actor, List.of(first, second));

		verify(meetingMapper).upsertIncrement(actor, first);
		verify(meetingMapper).upsertIncrement(actor, second);
		assertThat(redis.hasKey(firstKey)).isTrue();
		assertThat(redis.hasKey(secondKey)).isTrue();
	}

	private void waitUntilDeleted(String key) throws InterruptedException {
		long deadline = System.currentTimeMillis() + 3_000L;
		while (Boolean.TRUE.equals(redis.hasKey(key)) && System.currentTimeMillis() < deadline) {
			Thread.sleep(50L);
		}
		assertThat(redis.hasKey(key)).isFalse();
	}

	private String key(String first, String second) {
		String key = "meeting-cd:" + first + ":" + second;
		keysToDelete.add(key);
		return key;
	}

	private String email(String prefix) {
		return prefix + "-meeting-it-" + UUID.randomUUID() + "@test.local";
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}
}
