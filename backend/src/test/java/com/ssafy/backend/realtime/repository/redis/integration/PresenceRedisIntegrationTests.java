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
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;

/** 실제 Redis에서 사용자 배치와 상태 관리를 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class PresenceRedisIntegrationTests {

	private static LettuceConnectionFactory connectionFactory;
	private static StringRedisTemplate redis;
	private static PresenceRedisRepository repository;

	private final Set<String> keysToDelete = new LinkedHashSet<>();
	private final Set<String> expiryEmails = new LinkedHashSet<>();

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
				scripts.presenceLeaveScript(), scripts.usercountRecountScript());
	}

	@AfterEach
	void cleanKeys() {
		for (String email : expiryEmails) {
			redis.opsForZSet().remove("presence:expiry", email);
		}
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
	@DisplayName("첫 배치는 사용자와 곡과 셀 정보를 함께 저장한다")
	void firstJoinCreatesAllIndexes() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		connect(data.email(), 1L);

		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		PresenceSnapshot snapshot = repository.snapshot(data.email());
		assertThat(snapshot).isEqualTo(new PresenceSnapshot(data.music1(), data.layer1(), 3, 4, 1L));
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isTrue();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer1() + ":" + data.music1(), data.email())).isTrue();
		assertThat(redis.opsForSet().isMember(
				"active-song:cell:" + data.layer1() + ":3:4", Long.toString(data.music1()))).isTrue();
		assertThat(redis.opsForSet().isMember("active-song:cells:" + data.layer1(), "3:4")).isTrue();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isEqualTo("1");
	}

	@Test
	@DisplayName("레이어 이동은 이전 위치를 지우고 새 위치에 등록한다")
	void layerMoveReplacesLayerIndexes() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		trackJoinKeys(data.email(), data.music1(), data.layer2(), "7:8");
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.join(data.email(), data.music1(), data.layer1(), 3, 4,
				data.music1(), data.layer2(), 0.7, 0.8, 7, 8)).isTrue();

		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isTrue();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer1() + ":" + data.music1(), data.email())).isFalse();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isNull();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer2() + ":" + data.music1(), data.email())).isTrue();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer2(), "7:8")).isEqualTo("1");
		assertThat(repository.snapshot(data.email())).isEqualTo(
				new PresenceSnapshot(data.music1(), data.layer2(), 7, 8, 1L));
	}

	@Test
	@DisplayName("함께 있던 사용자가 남으면 이전 곡과 셀을 유지한다")
	void layerMoveKeepsSharedOldCell() {
		TestData data = testData();
		String remainingEmail = "presence-it-remaining-" + UUID.randomUUID() + "@test.local";
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		trackJoinKeys(data.email(), data.music1(), data.layer2(), "7:8");
		connect(data.email(), 1L);
		connect(remainingEmail, 1L);
		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();
		assertThat(repository.join(remainingEmail, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.join(data.email(), data.music1(), data.layer1(), 3, 4,
				data.music1(), data.layer2(), 0.7, 0.8, 7, 8)).isTrue();

		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer1() + ":" + data.music1(), remainingEmail)).isTrue();
		assertThat(redis.opsForSet().isMember(
				"active-song:cell:" + data.layer1() + ":3:4", Long.toString(data.music1()))).isTrue();
		assertThat(redis.opsForSet().isMember("active-song:cells:" + data.layer1(), "3:4")).isTrue();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isEqualTo("1");
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer2(), "7:8")).isEqualTo("1");
	}

	@Test
	@DisplayName("같은 자리 재요청은 인원수를 다시 올리지 않는다")
	void samePlaceDoesNotIncreaseUserCount() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.join(data.email(), data.music1(), data.layer1(), 3, 4,
				data.music1(), data.layer1(), 0.31, 0.41, 3, 4)).isTrue();

		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isEqualTo("1");
		assertThat(redis.opsForHash().get("presence:user:" + data.email(), "x")).isEqualTo("0.31");
		assertThat(redis.opsForHash().get("presence:user:" + data.email(), "y")).isEqualTo("0.41");
	}

	@Test
	@DisplayName("이전 곡이 다르면 배치 요청을 거부한다")
	void staleJoinKeepsCurrentState() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		trackJoinKeys(data.email(), data.music2(), data.layer2(), "7:8");
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.join(data.email(), data.music2(), data.layer1(), 3, 4,
				data.music2(), data.layer2(), 0.7, 0.8, 7, 8)).isFalse();

		assertThat(repository.snapshot(data.email())).isEqualTo(
				new PresenceSnapshot(data.music1(), data.layer1(), 3, 4, 1L));
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isTrue();
		assertThat(redis.opsForSet().isMember("listeners:" + data.music2(), data.email())).isFalse();
	}

	@Test
	@DisplayName("접속 상태가 없으면 배치 자료를 만들지 않는다")
	void missingPresenceRejectsJoin() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");

		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isFalse();

		assertThat(redis.hasKey("presence:user:" + data.email())).isFalse();
		assertThat(redis.hasKey("listeners:" + data.music1())).isFalse();
		assertThat(redis.hasKey("layer-listeners:" + data.layer1() + ":" + data.music1())).isFalse();
		assertThat(redis.hasKey("active-song:cell:" + data.layer1() + ":3:4")).isFalse();
		assertThat(redis.hasKey("active-song:cells:" + data.layer1())).isFalse();
		assertThat(redis.hasKey("cell:usercount:" + data.layer1())).isFalse();
	}

	@Test
	@DisplayName("함께 있던 사용자가 남으면 퇴장 뒤에도 곡과 셀을 유지한다")
	void leaveKeepsSharedCell() {
		TestData data = testData();
		String remainingEmail = "presence-it-remaining-" + UUID.randomUUID() + "@test.local";
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		connect(data.email(), 1L);
		connect(remainingEmail, 1L);
		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();
		assertThat(repository.join(remainingEmail, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.applyLeave(data.email(), 1L)).containsExactly(
				Long.toString(data.music1()), Integer.toString(data.layer1()), "3", "4", "1");

		assertThat(redis.hasKey("presence:user:" + data.email())).isFalse();
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), remainingEmail)).isTrue();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer1() + ":" + data.music1(), remainingEmail)).isTrue();
		assertThat(redis.opsForSet().isMember(
				"active-song:cell:" + data.layer1() + ":3:4", Long.toString(data.music1()))).isTrue();
		assertThat(redis.opsForSet().isMember("active-song:cells:" + data.layer1(), "3:4")).isTrue();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isEqualTo("1");
	}

	@Test
	@DisplayName("하트비트는 만료 시각을 갱신한다")
	void heartbeatUpdatesExpiry() {
		TestData data = testData();
		String missingEmail = "presence-it-missing-" + UUID.randomUUID() + "@test.local";
		connect(data.email(), 1L);
		long now = System.currentTimeMillis();
		redis.opsForZSet().add("presence:expiry", data.email(), now - 1);

		assertThat(repository.expired(now)).contains(data.email());
		assertThat(repository.touch(data.email(), 60_000L)).isTrue();
		assertThat(repository.expired(now)).doesNotContain(data.email());
		assertThat(redis.opsForZSet().score("presence:expiry", data.email())).isGreaterThan(now);
		assertThat(repository.touch(missingEmail, 60_000L)).isFalse();
	}

	@Test
	@DisplayName("인원수 대조는 틀린 값을 실제 값으로 고친다")
	void recountRepairsWrongCounts() {
		TestData data = testData();
		String cell = "3:4";
		String ghostCell = "9:9";
		String activeCellsKey = key("active-song:cells:" + data.layer1());
		String activeCellKey = key("active-song:cell:" + data.layer1() + ":" + cell);
		String firstListeners = key("layer-listeners:" + data.layer1() + ":" + data.music1());
		String secondListeners = key("layer-listeners:" + data.layer1() + ":" + data.music2());
		String userCountKey = key("cell:usercount:" + data.layer1());

		redis.opsForSet().add(activeCellsKey, cell);
		redis.opsForSet().add(activeCellKey, Long.toString(data.music1()), Long.toString(data.music2()));
		redis.opsForSet().add(firstListeners, "listener-a", "listener-b");
		redis.opsForSet().add(secondListeners, "listener-c");
		redis.opsForHash().put(userCountKey, cell, "99");
		redis.opsForHash().put(userCountKey, ghostCell, "1");

		assertThat(repository.recount(data.layer1())).isEqualTo(2L);
		assertThat(redis.opsForHash().get(userCountKey, cell)).isEqualTo("3");
		assertThat(redis.opsForHash().get(userCountKey, ghostCell)).isNull();
	}

	private void connect(String email, long epoch) {
		key("presence:user:" + email);
		expiryEmails.add(email);
		repository.connect(email, epoch, 60_000L);
	}

	private void trackJoinKeys(String email, long musicId, int layer, String cell) {
		key("presence:user:" + email);
		key("listeners:" + musicId);
		key("layer-listeners:" + layer + ":" + musicId);
		key("active-song:cell:" + layer + ":" + cell);
		key("active-song:cells:" + layer);
		key("cell:usercount:" + layer);
	}

	private TestData testData() {
		long base = Integer.toUnsignedLong(UUID.randomUUID().hashCode()) + 20_000_000L;
		String email = "presence-it-" + UUID.randomUUID() + "@test.local";
		int layer1 = (int) (base % 1_000_000L) + 20_000;
		return new TestData(email, base, base + 1, layer1, layer1 + 1);
	}

	private String key(String key) {
		keysToDelete.add(key);
		return key;
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}

	private record TestData(String email, long music1, long music2, int layer1, int layer2) {
	}
}
