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
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DismountResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DismountStatus;

/** 실제 Redis에서 하차가 등록을 지우고 지도에 다시 넣는지 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class RideDismountRedisIntegrationTests {

	private static final long MUSIC = 10877L;
	private static final int LAYER = 2;
	private static final int CELL_X = 7;
	private static final int CELL_Y = 5;
	private static final String CELL = CELL_X + ":" + CELL_Y;

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
				redis, scripts.rideMountScript(), scripts.rideDismountScript());
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
	@DisplayName("내리면 두 키가 같이 사라진다")
	void bothKeysGoAway() {
		String captain = user();
		String rider = user();
		givenRiding(captain, rider, 1L);

		DismountResult result = repository.dismount(rider, captain);

		assertThat(result.status()).isEqualTo(DismountStatus.OK);
		assertThat(redis.hasKey("ride:captain:" + rider)).isFalse();
		assertThat(repository.riders(captain)).doesNotContain(rider);
	}

	/** 다시 넣지 않으면 내린 뒤에도 남들 화면과 주변 사람 목록에 안 잡힌다. */
	@Test
	@DisplayName("내리면 지도 인덱스 다섯 곳에 다시 들어간다")
	void returnsToMap() {
		String captain = user();
		String rider = user();
		givenRiding(captain, rider, 1L);

		repository.dismount(rider, captain);

		assertThat(redis.opsForSet().isMember("listeners:" + MUSIC, rider)).isTrue();
		assertThat(redis.opsForSet().isMember("layer-listeners:" + LAYER + ":" + MUSIC, rider)).isTrue();
		assertThat(redis.opsForSet()
				.isMember("active-song:cell:" + LAYER + ":" + CELL, Long.toString(MUSIC))).isTrue();
		assertThat(redis.opsForSet().isMember("active-song:cells:" + LAYER, CELL)).isTrue();
		assertThat(redis.opsForHash().get("cell:usercount:" + LAYER, CELL)).isEqualTo("1");
	}

	@Test
	@DisplayName("내린 자리와 남은 인원을 돌려준다")
	void answersWithSpotAndRemaining() {
		String captain = user();
		String rider = user();
		String other = user();
		givenRiding(captain, rider, 1L);
		redis.opsForSet().add("ride:riders:" + captain, other);

		DismountResult result = repository.dismount(rider, captain);

		assertThat(result.musicId()).isEqualTo(MUSIC);
		assertThat(result.layer()).isEqualTo(LAYER);
		assertThat(result.cellX()).isEqualTo(CELL_X);
		assertThat(result.cellY()).isEqualTo(CELL_Y);
		assertThat(result.remainingRiders()).isEqualTo(1);
	}

	@Test
	@DisplayName("마지막 한 명이 내리면 남은 인원이 0 이다")
	void lastRiderLeavesZero() {
		String captain = user();
		String rider = user();
		givenRiding(captain, rider, 1L);

		assertThat(repository.dismount(rider, captain).remainingRiders()).isZero();
	}

	@Test
	@DisplayName("따라가는 중이 아니면 거부한다")
	void notRidingIsRejected() {
		String captain = user();
		String rider = user();
		standOnMusic(rider, 1L);

		assertThat(repository.dismount(rider, captain).status())
				.isEqualTo(DismountStatus.NOT_RIDING);
	}

	/** 그 사이에 갈아탔으면 엉뚱한 선단에서 빼게 된다. */
	@Test
	@DisplayName("따라가던 사람이 다르면 거부한다")
	void differentCaptainIsRejected() {
		String captain = user();
		String other = user();
		String rider = user();
		givenRiding(captain, rider, 1L);

		assertThat(repository.dismount(rider, other).status()).isEqualTo(DismountStatus.STALE);
		assertThat(redis.hasKey("ride:captain:" + rider)).isTrue();
		assertThat(repository.riders(captain)).contains(rider);
	}

	/** 이전 연결 때 만든 탑승은 지금 요청으로 지우지 않는다. */
	@Test
	@DisplayName("탑승한 접속과 지금 접속이 다르면 거부한다")
	void staleEpochIsRejected() {
		String captain = user();
		String rider = user();
		givenRiding(captain, rider, 1L);
		// 재연결해서 접속 번호가 올라간 상태
		redis.opsForHash().put("presence:user:" + rider, "epoch", "2");

		assertThat(repository.dismount(rider, captain).status()).isEqualTo(DismountStatus.STALE);
		assertThat(redis.hasKey("ride:captain:" + rider)).isTrue();
	}

	@Test
	@DisplayName("접속 정보가 없으면 거부한다")
	void noPresenceIsRejected() {
		String captain = user();
		String rider = user();
		keysToDelete.add("ride:captain:" + rider);
		redis.opsForHash().put("ride:captain:" + rider, "captain", captain);
		redis.opsForHash().put("ride:captain:" + rider, "epoch", "1");

		assertThat(repository.dismount(rider, captain).status()).isEqualTo(DismountStatus.STALE);
	}

	/** 탑승 뒤 상태를 만든다 — 자리는 presence 에만 있고 지도에는 없다. */
	private void givenRiding(String captain, String rider, long epoch) {
		standOnMusic(rider, epoch);
		redis.opsForHash().put("ride:captain:" + rider, "captain", captain);
		redis.opsForHash().put("ride:captain:" + rider, "epoch", Long.toString(epoch));
		redis.opsForSet().add("ride:riders:" + captain, rider);
	}

	/** 곡 위에 서 있되 지도 인덱스에는 넣지 않는다. ride-place.lua 가 만든 상태와 같다. */
	private void standOnMusic(String email, long epoch) {
		String key = "presence:user:" + email;
		redis.opsForHash().put(key, "epoch", Long.toString(epoch));
		redis.opsForHash().put(key, "musicId", Long.toString(MUSIC));
		redis.opsForHash().put(key, "layer", Integer.toString(LAYER));
		redis.opsForHash().put(key, "cellX", Integer.toString(CELL_X));
		redis.opsForHash().put(key, "cellY", Integer.toString(CELL_Y));
	}

	private String user() {
		String email = "ride-dm-it-" + UUID.randomUUID() + "@test.local";
		keysToDelete.add("presence:user:" + email);
		keysToDelete.add("ride:captain:" + email);
		keysToDelete.add("ride:riders:" + email);
		keysToDelete.add("listeners:" + MUSIC);
		keysToDelete.add("layer-listeners:" + LAYER + ":" + MUSIC);
		keysToDelete.add("active-song:cell:" + LAYER + ":" + CELL);
		keysToDelete.add("active-song:cells:" + LAYER);
		keysToDelete.add("cell:usercount:" + LAYER);
		return email;
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}
}
