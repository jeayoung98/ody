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
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DisbandResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.RiderLeaveResult;

/** 실제 Redis에서 선단 해체가 전원을 지도에 돌려보내고 흔적을 지우는지 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class RideDisbandRedisIntegrationTests {

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
	@DisplayName("따라가던 사람 전원이 지도에 다시 들어간다")
	void everyoneReturnsToMap() {
		String captain = user();
		String first = user();
		String second = user();
		givenRiding(captain, first);
		givenRiding(captain, second);

		DisbandResult result = repository.disband(captain);

		assertThat(result.hadRiders()).isTrue();
		assertThat(result.leftRiders()).containsExactlyInAnyOrder(first, second);
		assertThat(redis.opsForSet().isMember("listeners:" + MUSIC, first, second))
				.containsValues(true, true);
		assertThat(redis.opsForSet()
				.isMember("layer-listeners:" + LAYER + ":" + MUSIC, first, second))
				.containsValues(true, true);
		assertThat(redis.opsForHash().get("cell:usercount:" + LAYER, CELL)).isEqualTo("2");
	}

	/** 고아 키가 남으면 다음 선단이 엉뚱한 상태를 물려받는다. */
	@Test
	@DisplayName("선단의 흔적이 하나도 남지 않는다")
	void noRideKeysAreLeft() {
		String captain = user();
		String rider = user();
		givenRiding(captain, rider);
		redis.opsForHash().put("ride:playback:" + captain, "musicId", Long.toString(MUSIC));
		redis.opsForHash().put("ride:panel:" + captain, "musicId", Long.toString(MUSIC));

		repository.disband(captain);

		assertThat(redis.hasKey("ride:riders:" + captain)).isFalse();
		assertThat(redis.hasKey("ride:playback:" + captain)).isFalse();
		assertThat(redis.hasKey("ride:panel:" + captain)).isFalse();
		assertThat(redis.hasKey("ride:captain:" + rider)).isFalse();
	}

	/** 한 명씩 넣으면서 읽으면 뒤에 넣는 사람의 명단에 앞사람이 섞인다. */
	@Test
	@DisplayName("그 곡에 있던 사람들은 아무도 넣기 전에 읽는다")
	void residentsAreReadBeforeAnyoneReturns() {
		String captain = user();
		String first = user();
		String second = user();
		String outsider = user();
		givenRiding(captain, first);
		givenRiding(captain, second);
		redis.opsForSet().add("layer-listeners:" + LAYER + ":" + MUSIC, outsider);

		DisbandResult result = repository.disband(captain);

		assertThat(result.residents()).containsExactly(outsider);
	}

	@Test
	@DisplayName("내린 자리는 인솔자가 마지막으로 있던 곳이다")
	void answersWithSpot() {
		String captain = user();
		String rider = user();
		givenRiding(captain, rider);

		DisbandResult result = repository.disband(captain);

		assertThat(result.musicId()).isEqualTo(MUSIC);
		assertThat(result.layer()).isEqualTo(LAYER);
		assertThat(result.cellX()).isEqualTo(CELL_X);
		assertThat(result.cellY()).isEqualTo(CELL_Y);
	}

	/** 그 사람도 이미 나간 것이다. 지도에 넣으면 유령이 생긴다. */
	@Test
	@DisplayName("접속 정보가 없는 사람은 지도에 넣지 않는다")
	void goneRiderIsNotPutBack() {
		String captain = user();
		String alive = user();
		String gone = user();
		givenRiding(captain, alive);
		keysToDelete.add("ride:captain:" + gone);
		redis.opsForHash().put("ride:captain:" + gone, "captain", captain);
		redis.opsForSet().add("ride:riders:" + captain, gone);

		DisbandResult result = repository.disband(captain);

		assertThat(result.leftRiders()).containsExactly(alive);
		assertThat(redis.opsForSet().isMember("listeners:" + MUSIC, gone)).isFalse();
		// 그래도 따라가는 대상은 지운다. 남으면 유령 선단이 된다.
		assertThat(redis.hasKey("ride:captain:" + gone)).isFalse();
	}

	@Test
	@DisplayName("따라오던 사람이 없으면 남은 키만 지운다")
	void noRidersStillCleansUp() {
		String captain = user();
		redis.opsForHash().put("ride:playback:" + captain, "musicId", Long.toString(MUSIC));

		DisbandResult result = repository.disband(captain);

		assertThat(result.hadRiders()).isFalse();
		assertThat(result.leftRiders()).isEmpty();
		assertThat(redis.hasKey("ride:playback:" + captain)).isFalse();
	}

	// ── 따라가던 사람 한 명만 사라짐 ───────────────────────

	/** 선단은 그대로 둔다. 사라진 것은 인솔자가 아니라 따라가던 사람이다. */
	@Test
	@DisplayName("사라진 사람만 빠지고 선단은 남는다")
	void oneRiderLeavesFleetAlone() {
		String captain = user();
		String gone = user();
		String stays = user();
		givenRiding(captain, gone);
		givenRiding(captain, stays);

		RiderLeaveResult result = repository.riderLeave(gone);

		assertThat(result.captainEmail()).isEqualTo(captain);
		assertThat(result.remainingRiders()).isEqualTo(1);
		assertThat(redis.hasKey("ride:captain:" + gone)).isFalse();
		assertThat(repository.riders(captain)).containsExactly(stays);
	}

	/** 사라진 사람이라 넣으면 유령이 된다. 스스로 내리는 것과 다른 점이다. */
	@Test
	@DisplayName("사라진 사람은 지도에 다시 넣지 않는다")
	void goneRiderIsNotPutOnMap() {
		String captain = user();
		String gone = user();
		givenRiding(captain, gone);

		repository.riderLeave(gone);

		assertThat(redis.opsForSet().isMember("listeners:" + MUSIC, gone)).isFalse();
		assertThat(redis.opsForSet()
				.isMember("layer-listeners:" + LAYER + ":" + MUSIC, gone)).isFalse();
	}

	@Test
	@DisplayName("따라가는 중이 아니었으면 아무것도 돌려주지 않는다")
	void notRidingReturnsNothing() {
		assertThat(repository.riderLeave(user())).isNull();
	}

	/** 탑승 뒤 상태를 만든다 — 자리는 presence 에만 있고 지도에는 없다. */
	private void givenRiding(String captain, String rider) {
		String key = "presence:user:" + rider;
		redis.opsForHash().put(key, "epoch", "1");
		redis.opsForHash().put(key, "musicId", Long.toString(MUSIC));
		redis.opsForHash().put(key, "layer", Integer.toString(LAYER));
		redis.opsForHash().put(key, "cellX", Integer.toString(CELL_X));
		redis.opsForHash().put(key, "cellY", Integer.toString(CELL_Y));
		redis.opsForHash().put("ride:captain:" + rider, "captain", captain);
		redis.opsForHash().put("ride:captain:" + rider, "epoch", "1");
		redis.opsForSet().add("ride:riders:" + captain, rider);
	}

	private String user() {
		String email = "ride-db-it-" + UUID.randomUUID() + "@test.local";
		keysToDelete.add("presence:user:" + email);
		keysToDelete.add("ride:captain:" + email);
		keysToDelete.add("ride:riders:" + email);
		keysToDelete.add("ride:playback:" + email);
		keysToDelete.add("ride:panel:" + email);
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
