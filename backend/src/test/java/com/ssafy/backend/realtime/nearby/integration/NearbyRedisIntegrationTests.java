package com.ssafy.backend.realtime.nearby.integration;

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
import com.ssafy.backend.realtime.nearby.repository.NearbyRedisRepository;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;

/** 실제 Redis에서 주변사람 구독 Lua 동작을 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class NearbyRedisIntegrationTests {

	private static LettuceConnectionFactory connectionFactory;
	private static StringRedisTemplate redis;
	private static NearbyRedisRepository nearbyRepo;
	private static PresenceRedisRepository presenceRepo;

	private final Set<String> keysToDelete = new LinkedHashSet<>();
	private String expiryEmail;

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
		nearbyRepo = new NearbyRedisRepository(
				redis, scripts.nearbySubscriptionReplaceScript(), scripts.nearbySubscriptionCloseScript());
		presenceRepo = new PresenceRedisRepository(
				redis, scripts.presenceJoinScript(), scripts.presencePlayScript(),
				scripts.presenceLeaveScript(), scripts.usercountRecountScript());
	}

	@AfterEach
	void cleanKeys() {
		if (expiryEmail != null) {
			redis.opsForZSet().remove("presence:expiry", expiryEmail);
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
	@DisplayName("새 접속의 구독은 오래된 닫기 요청으로 삭제되지 않는다")
	void staleCloseKeepsNewSubscriptions() {
		TestKeys data = testKeys();
		String presenceKey = key("presence:user:" + data.email());
		String metaKey = key("nearby:meta:" + data.email());
		String firstSubscribers = key("nearby:subscribers:" + data.music1());
		String sharedSubscribers = key("nearby:subscribers:" + data.music2());
		String newSubscribers = key("nearby:subscribers:" + data.music3());

		redis.opsForHash().put(presenceKey, "epoch", "1");
		assertThat(nearbyRepo.replaceSubscriptions(
				data.email(), 1L, List.of(data.music1(), data.music2()))).isTrue();

		redis.opsForHash().put(presenceKey, "epoch", "2");
		assertThat(nearbyRepo.replaceSubscriptions(
				data.email(), 2L, List.of(data.music2(), data.music3()))).isTrue();

		assertThat(redis.opsForSet().isMember(firstSubscribers, data.email())).isFalse();
		assertThat(redis.opsForSet().isMember(sharedSubscribers, data.email())).isTrue();
		assertThat(redis.opsForSet().isMember(newSubscribers, data.email())).isTrue();
		assertThat(redis.opsForHash().get(metaKey, "epoch")).isEqualTo("2");

		assertThat(nearbyRepo.closeSubscriptions(data.email(), 1L)).isFalse();
		assertThat(redis.hasKey(metaKey)).isTrue();
		assertThat(redis.opsForSet().isMember(sharedSubscribers, data.email())).isTrue();
		assertThat(redis.opsForSet().isMember(newSubscribers, data.email())).isTrue();

		assertThat(nearbyRepo.closeSubscriptions(data.email(), 2L)).isTrue();
		assertThat(redis.hasKey(metaKey)).isFalse();
		assertThat(redis.opsForSet().isMember(sharedSubscribers, data.email())).isFalse();
		assertThat(redis.opsForSet().isMember(newSubscribers, data.email())).isFalse();
	}

	@Test
	@DisplayName("직접 종료하면 사용자 상태와 주변사람 구독을 함께 삭제한다")
	void leaveRemovesPresenceAndNearbySubscriptions() {
		TestKeys data = testKeys();
		String presenceKey = key("presence:user:" + data.email());
		String listenerKey = key("listeners:" + data.music1());
		String layerListenerKey = key("layer-listeners:" + data.layer() + ":" + data.music1());
		String activeCellKey = key("active-song:cell:" + data.layer() + ":3:4");
		String activeCellsKey = key("active-song:cells:" + data.layer());
		String userCountKey = key("cell:usercount:" + data.layer());
		String metaKey = key("nearby:meta:" + data.email());
		String subscribers1 = key("nearby:subscribers:" + data.music1());
		String subscribers2 = key("nearby:subscribers:" + data.music2());
		expiryEmail = data.email();

		redis.opsForHash().putAll(presenceKey, java.util.Map.of(
				"epoch", "7", "musicId", Long.toString(data.music1()),
				"layer", Integer.toString(data.layer()), "cellX", "3", "cellY", "4"));
		redis.opsForZSet().add("presence:expiry", data.email(), System.currentTimeMillis() + 60_000);
		redis.opsForSet().add(listenerKey, data.email());
		redis.opsForSet().add(layerListenerKey, data.email());
		redis.opsForSet().add(activeCellKey, Long.toString(data.music1()));
		redis.opsForSet().add(activeCellsKey, "3:4");
		redis.opsForHash().put(userCountKey, "3:4", "1");
		redis.opsForHash().putAll(metaKey, java.util.Map.of(
				"epoch", "7", "musicIds", data.music1() + "," + data.music2()));
		redis.opsForSet().add(subscribers1, data.email());
		redis.opsForSet().add(subscribers2, data.email());

		assertThat(presenceRepo.applyLeave(data.email(), 7L)).containsExactly(
				Long.toString(data.music1()), Integer.toString(data.layer()), "3", "4", "7");

		assertThat(redis.hasKey(presenceKey)).isFalse();
		assertThat(redis.opsForZSet().score("presence:expiry", data.email())).isNull();
		assertThat(redis.opsForSet().isMember(listenerKey, data.email())).isFalse();
		assertThat(redis.opsForSet().isMember(layerListenerKey, data.email())).isFalse();
		assertThat(redis.opsForSet().isMember(activeCellKey, Long.toString(data.music1()))).isFalse();
		assertThat(redis.opsForSet().isMember(activeCellsKey, "3:4")).isFalse();
		assertThat(redis.opsForHash().get(userCountKey, "3:4")).isNull();
		assertThat(redis.hasKey(metaKey)).isFalse();
		assertThat(redis.opsForSet().isMember(subscribers1, data.email())).isFalse();
		assertThat(redis.opsForSet().isMember(subscribers2, data.email())).isFalse();
	}

	@Test
	@DisplayName("오래된 접속의 종료 요청은 현재 상태를 삭제하지 않는다")
	void staleLeaveKeepsCurrentPresence() {
		TestKeys data = testKeys();
		String presenceKey = key("presence:user:" + data.email());
		String metaKey = key("nearby:meta:" + data.email());
		String subscribersKey = key("nearby:subscribers:" + data.music1());

		redis.opsForHash().putAll(presenceKey, java.util.Map.of(
				"epoch", "2", "musicId", Long.toString(data.music1()),
				"layer", Integer.toString(data.layer()), "cellX", "3", "cellY", "4"));
		redis.opsForHash().putAll(metaKey, java.util.Map.of(
				"epoch", "2", "musicIds", Long.toString(data.music1())));
		redis.opsForSet().add(subscribersKey, data.email());

		assertThat(presenceRepo.applyLeave(data.email(), 1L)).isEmpty();
		assertThat(redis.hasKey(presenceKey)).isTrue();
		assertThat(redis.hasKey(metaKey)).isTrue();
		assertThat(redis.opsForSet().isMember(subscribersKey, data.email())).isTrue();
	}

	@Test
	@DisplayName("만료 확인 뒤 재접속하면 현재 상태를 삭제하지 않는다")
	void reconnectKeepsPresenceDuringExpiredLeave() {
		TestKeys data = testKeys();
		String presenceKey = key("presence:user:" + data.email());
		String metaKey = key("nearby:meta:" + data.email());
		String subscribersKey = key("nearby:subscribers:" + data.music1());
		long sweepTime = System.currentTimeMillis();
		expiryEmail = data.email();

		redis.opsForHash().putAll(presenceKey, java.util.Map.of(
				"epoch", "2", "musicId", Long.toString(data.music1()),
				"layer", Integer.toString(data.layer()), "cellX", "3", "cellY", "4"));
		redis.opsForZSet().add("presence:expiry", data.email(), sweepTime + 60_000);
		redis.opsForHash().putAll(metaKey, java.util.Map.of(
				"epoch", "2", "musicIds", Long.toString(data.music1())));
		redis.opsForSet().add(subscribersKey, data.email());

		assertThat(presenceRepo.applyLeaveExpired(data.email(), sweepTime)).isEmpty();
		assertThat(redis.hasKey(presenceKey)).isTrue();
		assertThat(redis.hasKey(metaKey)).isTrue();
		assertThat(redis.opsForSet().isMember(subscribersKey, data.email())).isTrue();
	}

	private TestKeys testKeys() {
		long base = Integer.toUnsignedLong(UUID.randomUUID().hashCode()) + 10_000_000L;
		String email = "nearby-it-" + UUID.randomUUID() + "@test.local";
		int layer = (int) (base % 1_000_000L) + 10_000;
		return new TestKeys(email, base, base + 1, base + 2, layer);
	}

	private String key(String key) {
		keysToDelete.add(key);
		return key;
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}

	private record TestKeys(String email, long music1, long music2, long music3, int layer) {
	}
}
