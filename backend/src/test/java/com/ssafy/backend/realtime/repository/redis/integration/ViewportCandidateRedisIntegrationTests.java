package com.ssafy.backend.realtime.repository.redis.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import com.ssafy.backend.realtime.config.RedisScriptConfig;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;

/** 실제 Redis에서 화면 후보 곡과 청취자 묶음 조회를 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class ViewportCandidateRedisIntegrationTests {

	private static LettuceConnectionFactory connectionFactory;
	private static StringRedisTemplate redis;
	private static PresenceRedisRepository repository;

	private final Set<String> keysToDelete = new LinkedHashSet<>();

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

		RedisScriptConfig scripts = new RedisScriptConfig();
		repository = new PresenceRedisRepository(
				redis, scripts.presenceJoinScript(), scripts.presencePlayScript(),
				scripts.presenceLeaveScript(), scripts.usercountRecountScript(),
				scripts.ridePlaceScript());
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
	@DisplayName("화면 셀마다 재생 중인 곡을 나눠서 돌려준다")
	void readsActiveMusicByCell() {
		int layer = 2;
		Cell first = new Cell(1, 2);
		Cell second = new Cell(3, 4);
		long music1 = musicId();
		long music2 = musicId();
		String firstKey = track("active-song:cell:" + layer + ":1:2");
		track("active-song:cell:" + layer + ":3:4");
		redis.opsForSet().add(firstKey, Long.toString(music1), Long.toString(music2));

		var result = repository.findActiveMusicIdsByCell(layer, List.of(first, second));

		assertThat(result.get(first)).containsExactlyInAnyOrder(music1, music2);
		assertThat(result.get(second)).isEmpty();
	}

	@Test
	@DisplayName("곡마다 현재 레이어에서 듣는 사용자를 나눠서 돌려준다")
	void readsListenersByMusic() {
		int layer = 3;
		long music1 = musicId();
		long music2 = musicId();
		String firstKey = track("layer-listeners:" + layer + ":" + music1);
		String secondKey = track("layer-listeners:" + layer + ":" + music2);
		redis.opsForSet().add(firstKey, "a@test.local", "b@test.local");
		redis.opsForSet().add(secondKey, "c@test.local");

		var result = repository.findListenersByMusic(layer, List.of(music1, music2));

		assertThat(result.get(music1)).containsExactlyInAnyOrder("a@test.local", "b@test.local");
		assertThat(result.get(music2)).containsExactly("c@test.local");
	}

	private String track(String key) {
		keysToDelete.add(key);
		return key;
	}

	private static long musicId() {
		return Integer.toUnsignedLong(UUID.randomUUID().hashCode()) + 30_000_000L;
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}
}
