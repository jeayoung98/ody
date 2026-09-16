package com.ssafy.backend.realtime.play.integration;

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
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository.PresenceSnapshot;

/** 실제 Redis에서 곡 변경 Lua 동작을 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class MusicPlayRedisIntegrationTests {

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
	@DisplayName("곡을 바꾸면 이전 위치를 지우고 같은 레이어 청취자를 반환한다")
	void playMovesStateAndReturnsMeetingCandidates() {
		TestData data = testData();
		String sameLayerListener = "same-layer-" + UUID.randomUUID() + "@test.local";
		String otherLayerListener = "other-layer-" + UUID.randomUUID() + "@test.local";
		trackPlace(data.music1(), data.layer(), "3:4");
		trackPlace(data.music2(), data.layer(), "7:8");
		key("layer-listeners:" + data.otherLayer() + ":" + data.music2());
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer(), 0.3, 0.4, 3, 4)).isTrue();
		seedListener(sameLayerListener, data.music2(), data.layer(), "7:8");
		redis.opsForSet().add(
				"layer-listeners:" + data.otherLayer() + ":" + data.music2(), otherLayerListener);

		List<String> meeting = repository.applyPlay(
				data.email(), data.music1(), data.layer(), 3, 4,
				data.music2(), data.layer(), 0.7, 0.8, 7, 8);

		assertThat(meeting).containsExactly(sameLayerListener);
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isFalse();
		assertThat(redis.opsForSet().isMember("listeners:" + data.music2(), data.email())).isTrue();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer() + ":" + data.music1(), data.email())).isFalse();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer() + ":" + data.music2(), data.email())).isTrue();
		assertThat(redis.opsForSet().isMember(
				"active-song:cell:" + data.layer() + ":3:4", Long.toString(data.music1()))).isFalse();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer(), "3:4")).isNull();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer(), "7:8")).isEqualTo("2");
		assertThat(repository.snapshot(data.email())).isEqualTo(
				new PresenceSnapshot(data.music2(), data.layer(), 7, 8, 1L));
	}

	@Test
	@DisplayName("같은 곡 재요청은 만남과 인원수를 늘리지 않는다")
	void samePlacePlayDoesNotDuplicateState() {
		TestData data = testData();
		String listener = "same-place-" + UUID.randomUUID() + "@test.local";
		trackPlace(data.music1(), data.layer(), "3:4");
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer(), 0.3, 0.4, 3, 4)).isTrue();
		redis.opsForSet().add(
				"layer-listeners:" + data.layer() + ":" + data.music1(), listener);

		List<String> meeting = repository.applyPlay(
				data.email(), data.music1(), data.layer(), 3, 4,
				data.music1(), data.layer(), 0.31, 0.41, 3, 4);

		assertThat(meeting).isEmpty();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer(), "3:4")).isEqualTo("1");
		assertThat(redis.opsForHash().get("presence:user:" + data.email(), "x")).isEqualTo("0.31");
		assertThat(redis.opsForHash().get("presence:user:" + data.email(), "y")).isEqualTo("0.41");
	}

	@Test
	@DisplayName("함께 있던 사용자가 남으면 곡 변경 뒤에도 이전 셀을 유지한다")
	void playKeepsSharedOldCell() {
		TestData data = testData();
		String remainingEmail = "play-it-remaining-" + UUID.randomUUID() + "@test.local";
		trackPlace(data.music1(), data.layer(), "3:4");
		trackPlace(data.music2(), data.layer(), "7:8");
		connect(data.email(), 1L);
		connect(remainingEmail, 1L);
		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer(), 0.3, 0.4, 3, 4)).isTrue();
		assertThat(repository.join(remainingEmail, null, null, null, null,
				data.music1(), data.layer(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.applyPlay(
				data.email(), data.music1(), data.layer(), 3, 4,
				data.music2(), data.layer(), 0.7, 0.8, 7, 8)).isEmpty();

		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), remainingEmail)).isTrue();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer() + ":" + data.music1(), remainingEmail)).isTrue();
		assertThat(redis.opsForSet().isMember(
				"active-song:cell:" + data.layer() + ":3:4", Long.toString(data.music1()))).isTrue();
		assertThat(redis.opsForSet().isMember("active-song:cells:" + data.layer(), "3:4")).isTrue();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer(), "3:4")).isEqualTo("1");
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer(), "7:8")).isEqualTo("1");
	}

	@Test
	@DisplayName("이전 곡이 다르면 곡 변경을 거부한다")
	void stalePlayKeepsCurrentState() {
		TestData data = testData();
		trackPlace(data.music1(), data.layer(), "3:4");
		trackPlace(data.music2(), data.layer(), "7:8");
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), null, null, null, null,
				data.music1(), data.layer(), 0.3, 0.4, 3, 4)).isTrue();

		List<String> meeting = repository.applyPlay(
				data.email(), data.music2(), data.layer(), 3, 4,
				data.music2(), data.layer(), 0.7, 0.8, 7, 8);

		assertThat(meeting).isNull();
		assertThat(repository.snapshot(data.email())).isEqualTo(
				new PresenceSnapshot(data.music1(), data.layer(), 3, 4, 1L));
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isTrue();
		assertThat(redis.opsForSet().isMember("listeners:" + data.music2(), data.email())).isFalse();
	}

	@Test
	@DisplayName("접속 상태가 없으면 곡 변경 자료를 만들지 않는다")
	void missingPresenceRejectsPlay() {
		TestData data = testData();
		trackPlace(data.music1(), data.layer(), "3:4");

		assertThat(repository.applyPlay(
				data.email(), null, null, null, null,
				data.music1(), data.layer(), 0.3, 0.4, 3, 4)).isNull();

		assertThat(redis.hasKey("presence:user:" + data.email())).isFalse();
		assertThat(redis.hasKey("listeners:" + data.music1())).isFalse();
		assertThat(redis.hasKey("layer-listeners:" + data.layer() + ":" + data.music1())).isFalse();
		assertThat(redis.hasKey("active-song:cell:" + data.layer() + ":3:4")).isFalse();
		assertThat(redis.hasKey("active-song:cells:" + data.layer())).isFalse();
		assertThat(redis.hasKey("cell:usercount:" + data.layer())).isFalse();
	}

	private void connect(String email, long epoch) {
		key("presence:user:" + email);
		expiryEmails.add(email);
		repository.connect(email, epoch, 60_000L);
	}

	private void seedListener(String email, long musicId, int layer, String cell) {
		redis.opsForSet().add("listeners:" + musicId, email);
		redis.opsForSet().add("layer-listeners:" + layer + ":" + musicId, email);
		redis.opsForSet().add("active-song:cell:" + layer + ":" + cell, Long.toString(musicId));
		redis.opsForSet().add("active-song:cells:" + layer, cell);
		redis.opsForHash().put("cell:usercount:" + layer, cell, "1");
	}

	private void trackPlace(long musicId, int layer, String cell) {
		key("listeners:" + musicId);
		key("layer-listeners:" + layer + ":" + musicId);
		key("active-song:cell:" + layer + ":" + cell);
		key("active-song:cells:" + layer);
		key("cell:usercount:" + layer);
	}

	private TestData testData() {
		long base = Integer.toUnsignedLong(UUID.randomUUID().hashCode()) + 30_000_000L;
		String email = "play-it-" + UUID.randomUUID() + "@test.local";
		int layer = (int) (base % 1_000_000L) + 30_000;
		return new TestData(email, base, base + 1, layer, layer + 1);
	}

	private String key(String key) {
		keysToDelete.add(key);
		return key;
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}

	private record TestData(String email, long music1, long music2, int layer, int otherLayer) {
	}
}
