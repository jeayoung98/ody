package com.ssafy.backend.realtime.repository.redis.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.LinkedHashSet;
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
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;

/**
 * 실제 Redis에서 "지금 태우고 있는 사람 전원" 을 찾아내는지 검증한다.
 *
 * 훑기는 Redis 전체 키를 지나가므로 다른 시험이 남긴 키가 섞일 수 있다.
 * 그래서 결과 전체를 비교하지 않고 이 시험이 만든 이메일만 골라서 본다.
 */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class RideRankingScanRedisIntegrationTests {

	private static LettuceConnectionFactory connectionFactory;
	private static StringRedisTemplate redis;
	private static RideRedisRepository repository;

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
		repository = new RideRedisRepository(
				redis, scripts.rideMountScript(), scripts.rideDismountScript(),
				scripts.rideDisbandScript(), scripts.rideRiderLeaveScript());
	}

	@AfterEach
	void cleanKeys() {
		if (!keysToDelete.isEmpty()) {
			redis.delete(keysToDelete);
			keysToDelete.clear();
		}
	}

	@AfterAll
	static void disconnectRedis() {
		if (connectionFactory != null) {
			connectionFactory.destroy();
		}
	}

	@Test
	@DisplayName("아무도 안 태우고 있으면 그 사람은 결과에 없다")
	void captainWithoutRidersIsAbsent() {
		String captain = captain();

		assertThat(repository.captainsWithRiders()).doesNotContain(captain);
	}

	@Test
	@DisplayName("한 명을 태우면 결과에 나온다")
	void captainWithOneRiderAppears() {
		String captain = captain();
		redis.opsForSet().add("ride:riders:" + captain, rider());

		assertThat(repository.captainsWithRiders()).contains(captain);
	}

	/** 여러 명이어도 인솔자는 키 하나라 한 번만 나와야 한다. */
	@Test
	@DisplayName("여러 명을 태워도 인솔자는 한 번만 나온다")
	void captainAppearsOnceRegardlessOfRiderCount() {
		String captain = captain();
		redis.opsForSet().add("ride:riders:" + captain, rider(), rider(), rider());

		assertThat(repository.captainsWithRiders().stream().filter(captain::equals).count())
				.isEqualTo(1);
	}

	/**
	 * 이 시험이 "키가 있으면 태우고 있다" 는 전제를 지킨다.
	 * 마지막 한 명이 빠지면 Redis 가 키를 스스로 지우므로 결과에서도 사라져야 한다.
	 */
	@Test
	@DisplayName("마지막 한 명이 내리면 결과에서 사라진다")
	void captainDisappearsWhenLastRiderLeaves() {
		String captain = captain();
		String rider = rider();
		redis.opsForSet().add("ride:riders:" + captain, rider);
		assertThat(repository.captainsWithRiders()).contains(captain);

		redis.opsForSet().remove("ride:riders:" + captain, rider);

		assertThat(redis.hasKey("ride:riders:" + captain)).isFalse();
		assertThat(repository.captainsWithRiders()).doesNotContain(captain);
	}

	/**
	 * ride:captain 과 ride:riders 는 앞부분이 겹친다.
	 * 따라가는 사람이 태우는 사람으로 잘못 잡히면 랭킹에 0명이 섞인다.
	 */
	@Test
	@DisplayName("따라가는 사람은 결과에 섞이지 않는다")
	void riderSideKeyIsNotPickedUp() {
		String rider = rider();
		String key = "ride:captain:" + rider;
		keysToDelete.add(key);
		redis.opsForHash().put(key, "captain", "someone@test.local");
		redis.opsForHash().put(key, "epoch", "1");

		assertThat(repository.captainsWithRiders()).doesNotContain(rider);
	}

	/** 이메일 안에 콜론이 있어도 키 이름에서 앞부분만 정확히 떼어내야 한다. */
	@Test
	@DisplayName("이메일을 키 이름에서 그대로 되찾는다")
	void emailIsRestoredFromKeyName() {
		String captain = captain();
		redis.opsForSet().add("ride:riders:" + captain, rider());

		assertThat(repository.captainsWithRiders())
				.filteredOn(captain::equals)
				.singleElement()
				.isEqualTo(captain);
	}

	private String captain() {
		String email = "ride-ranking-it-captain-" + UUID.randomUUID() + "@test.local";
		keysToDelete.add("ride:riders:" + email);
		return email;
	}

	private String rider() {
		return "ride-ranking-it-rider-" + UUID.randomUUID() + "@test.local";
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}
}
