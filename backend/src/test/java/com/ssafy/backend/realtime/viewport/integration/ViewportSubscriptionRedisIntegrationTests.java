package com.ssafy.backend.realtime.viewport.integration;

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
import com.ssafy.backend.realtime.geometry.CellGrid.Cell;
import com.ssafy.backend.realtime.geometry.Viewport;
import com.ssafy.backend.realtime.viewport.repository.ViewportRedisRepository;
import com.ssafy.backend.realtime.viewport.repository.ViewportRedisRepository.ReplaceResult;

/** 실제 Redis에서 화면 셀 구독 교체를 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class ViewportSubscriptionRedisIntegrationTests {

	private static LettuceConnectionFactory connectionFactory;
	private static StringRedisTemplate redis;
	private static ViewportRedisRepository repository;

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
		repository = new ViewportRedisRepository(redis, scripts.viewportSubscriptionReplaceScript());
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
	@DisplayName("새 화면을 적용하면 이전 셀을 빼고 새 셀을 구독한다")
	void replacesCellSubscriptionsAndMeta() {
		TestData data = testData();
		connect(data.email(), 7L);
		Viewport first = new Viewport(1, -4.0, 4.0, -4.0, 4.0, List.of());
		Viewport second = new Viewport(1, -2.0, 6.0, -3.0, 5.0, List.of());
		Cell removed = new Cell(1, 1);
		Cell shared = new Cell(1, 2);
		Cell added = new Cell(2, 2);
		trackCell(1, removed);
		trackCell(1, shared);
		trackCell(1, added);

		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 1L, first, Set.of(removed, shared)))
				.isEqualTo(ReplaceResult.APPLIED);
		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 2L, second, Set.of(shared, added)))
				.isEqualTo(ReplaceResult.APPLIED);

		assertThat(isSubscribed(data.email(), 1, removed)).isFalse();
		assertThat(isSubscribed(data.email(), 1, shared)).isTrue();
		assertThat(isSubscribed(data.email(), 1, added)).isTrue();
		assertThat(repository.findMeta(data.email())).hasValueSatisfying(meta -> {
			assertThat(meta.epoch()).isEqualTo(7L);
			assertThat(meta.requestSeq()).isEqualTo(2L);
			assertThat(meta.viewport()).isEqualTo(second);
			assertThat(meta.cells()).containsExactlyInAnyOrder(shared, added);
		});
	}

	@Test
	@DisplayName("오래된 화면 요청은 현재 구독을 바꾸지 않는다")
	void oldRequestKeepsCurrentSubscriptions() {
		TestData data = testData();
		connect(data.email(), 7L);
		Viewport viewport = new Viewport(1, -1.0, 1.0, -1.0, 1.0, List.of());
		Cell current = new Cell(3, 3);
		Cell old = new Cell(4, 4);
		trackCell(1, current);
		trackCell(1, old);

		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 5L, viewport, Set.of(current)))
				.isEqualTo(ReplaceResult.APPLIED);
		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 4L, viewport, Set.of(old)))
				.isEqualTo(ReplaceResult.OLD_REQUEST);

		assertThat(isSubscribed(data.email(), 1, current)).isTrue();
		assertThat(isSubscribed(data.email(), 1, old)).isFalse();
		assertThat(repository.findMeta(data.email()).orElseThrow().requestSeq()).isEqualTo(5L);
	}

	@Test
	@DisplayName("이전 접속은 현재 화면 구독을 바꾸지 못한다")
	void staleConnectionKeepsCurrentSubscriptions() {
		TestData data = testData();
		connect(data.email(), 2L);
		Viewport viewport = new Viewport(1, -1.0, 1.0, -1.0, 1.0, List.of());
		Cell cell = new Cell(5, 5);
		trackCell(1, cell);

		assertThat(repository.replaceSubscriptions(
				data.email(), 1L, 1L, viewport, Set.of(cell)))
				.isEqualTo(ReplaceResult.STALE_CONNECTION);

		assertThat(isSubscribed(data.email(), 1, cell)).isFalse();
		assertThat(repository.findMeta(data.email())).isEmpty();
	}

	@Test
	@DisplayName("재접속하면 화면 요청 순번을 1부터 다시 시작할 수 있다")
	void newConnectionCanRestartRequestSequence() {
		TestData data = testData();
		connect(data.email(), 1L);
		Viewport viewport = new Viewport(1, -1.0, 1.0, -1.0, 1.0, List.of());
		Cell oldCell = new Cell(6, 6);
		Cell newCell = new Cell(7, 7);
		trackCell(1, oldCell);
		trackCell(1, newCell);

		assertThat(repository.replaceSubscriptions(
				data.email(), 1L, 99L, viewport, Set.of(oldCell)))
				.isEqualTo(ReplaceResult.APPLIED);
		redis.opsForHash().put("presence:user:" + data.email(), "epoch", "2");

		assertThat(repository.replaceSubscriptions(
				data.email(), 2L, 1L, viewport, Set.of(newCell)))
				.isEqualTo(ReplaceResult.APPLIED);
		assertThat(isSubscribed(data.email(), 1, oldCell)).isFalse();
		assertThat(isSubscribed(data.email(), 1, newCell)).isTrue();
		assertThat(repository.findMeta(data.email()).orElseThrow().requestSeq()).isEqualTo(1L);
	}

	private void connect(String email, long epoch) {
		String key = "presence:user:" + email;
		keysToDelete.add(key);
		keysToDelete.add("viewport:meta:" + email);
		redis.opsForHash().put(key, "epoch", Long.toString(epoch));
	}

	private void trackCell(int layer, Cell cell) {
		keysToDelete.add(cellKey(layer, cell));
	}

	private boolean isSubscribed(String email, int layer, Cell cell) {
		return Boolean.TRUE.equals(redis.opsForSet().isMember(cellKey(layer, cell), email));
	}

	private static String cellKey(int layer, Cell cell) {
		return "viewport:cell:" + layer + ":" + cell.cellX() + ":" + cell.cellY();
	}

	private TestData testData() {
		return new TestData("viewport-it-" + UUID.randomUUID() + "@test.local");
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}

	private record TestData(String email) {
	}
}
