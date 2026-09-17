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
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.CloseResult;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ReplaceResult;

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
		repository = new ViewportRedisRepository(
				redis,
				scripts.viewportSubscriptionReplaceScript(),
				scripts.viewportSubscriptionCloseScript());
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
		ViewportRange first = new ViewportRange(1, -4.0, 4.0, -4.0, 4.0, List.of());
		ViewportRange second = new ViewportRange(1, -2.0, 6.0, -3.0, 5.0, List.of());
		Cell removed = new Cell(1, 1);
		Cell shared = new Cell(1, 2);
		Cell added = new Cell(2, 2);
		trackCell(1, removed);
		trackCell(1, shared);
		trackCell(1, added);

		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 1L, first, ViewportMode.INDIVIDUAL, Set.of(removed, shared)))
				.isEqualTo(ReplaceResult.APPLIED);
		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 2L, second, ViewportMode.INDIVIDUAL, Set.of(shared, added)))
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
		ViewportRange viewport = new ViewportRange(1, -1.0, 1.0, -1.0, 1.0, List.of());
		Cell current = new Cell(3, 3);
		Cell old = new Cell(4, 4);
		trackCell(1, current);
		trackCell(1, old);

		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 5L, viewport, ViewportMode.INDIVIDUAL, Set.of(current)))
				.isEqualTo(ReplaceResult.APPLIED);
		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 4L, viewport, ViewportMode.INDIVIDUAL, Set.of(old)))
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
		ViewportRange viewport = new ViewportRange(1, -1.0, 1.0, -1.0, 1.0, List.of());
		Cell cell = new Cell(5, 5);
		trackCell(1, cell);

		assertThat(repository.replaceSubscriptions(
				data.email(), 1L, 1L, viewport, ViewportMode.INDIVIDUAL, Set.of(cell)))
				.isEqualTo(ReplaceResult.STALE_CONNECTION);

		assertThat(isSubscribed(data.email(), 1, cell)).isFalse();
		assertThat(repository.findMeta(data.email())).isEmpty();
	}

	@Test
	@DisplayName("재접속하면 화면 요청 순번을 1부터 다시 시작할 수 있다")
	void newConnectionCanRestartRequestSequence() {
		TestData data = testData();
		connect(data.email(), 1L);
		ViewportRange viewport = new ViewportRange(1, -1.0, 1.0, -1.0, 1.0, List.of());
		Cell oldCell = new Cell(6, 6);
		Cell newCell = new Cell(7, 7);
		trackCell(1, oldCell);
		trackCell(1, newCell);

		assertThat(repository.replaceSubscriptions(
				data.email(), 1L, 99L, viewport, ViewportMode.INDIVIDUAL, Set.of(oldCell)))
				.isEqualTo(ReplaceResult.APPLIED);
		redis.opsForHash().put("presence:user:" + data.email(), "epoch", "2");

		assertThat(repository.replaceSubscriptions(
				data.email(), 2L, 1L, viewport, ViewportMode.INDIVIDUAL, Set.of(newCell)))
				.isEqualTo(ReplaceResult.APPLIED);
		assertThat(isSubscribed(data.email(), 1, oldCell)).isFalse();
		assertThat(isSubscribed(data.email(), 1, newCell)).isTrue();
		assertThat(repository.findMeta(data.email()).orElseThrow().requestSeq()).isEqualTo(1L);
	}

	@Test
	@DisplayName("개별 사용자 화면과 셀별 인원수 화면을 바꿀 때 이전 구독을 지운다")
	void switchesModesWithoutOldSubscriptions() {
		TestData data = testData();
		connect(data.email(), 7L);
		ViewportRange viewport = new ViewportRange(1, -2.0, 2.0, -2.0, 2.0, List.of());
		Cell first = new Cell(1, 1);
		Cell second = new Cell(2, 2);
		trackCell(1, first);
		trackCell(1, second);
		trackClustered(1);

		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 1L, viewport, ViewportMode.INDIVIDUAL, Set.of(first)))
				.isEqualTo(ReplaceResult.APPLIED);
		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 1L, viewport, ViewportMode.CLUSTERED, Set.of()))
				.isEqualTo(ReplaceResult.APPLIED);

		assertThat(isSubscribed(data.email(), 1, first)).isFalse();
		assertThat(isClustered(data.email(), 1)).isTrue();
		assertThat(repository.findMeta(data.email())).hasValueSatisfying(meta -> {
			assertThat(meta.mode()).isEqualTo(ViewportMode.CLUSTERED);
			assertThat(meta.cells()).isEmpty();
		});
		assertThat(repository.findCellCountUsersByLayer(1))
				.containsEntry(1, Set.of(data.email()));
		assertThat(repository.findMetaByEmails(Set.of(data.email())))
				.containsKey(data.email());

		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 2L, viewport, ViewportMode.INDIVIDUAL, Set.of(second)))
				.isEqualTo(ReplaceResult.APPLIED);

		assertThat(isClustered(data.email(), 1)).isFalse();
		assertThat(isSubscribed(data.email(), 1, second)).isTrue();
		assertThat(repository.findCellCountUsersByLayer(1)).isEmpty();
		assertThat(repository.findMeta(data.email())).hasValueSatisfying(meta -> {
			assertThat(meta.mode()).isEqualTo(ViewportMode.INDIVIDUAL);
			assertThat(meta.cells()).containsExactly(second);
		});
	}

	@Test
	@DisplayName("개별 사용자 화면을 닫으면 셀 구독과 화면 정보를 지운다")
	void closesIndividualSubscriptionsAndMeta() {
		TestData data = testData();
		connect(data.email(), 7L);
		ViewportRange viewport = new ViewportRange(1, -2.0, 2.0, -2.0, 2.0, List.of());
		Cell first = new Cell(1, 1);
		Cell second = new Cell(2, 2);
		trackCell(1, first);
		trackCell(1, second);
		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 18L, viewport, ViewportMode.INDIVIDUAL, Set.of(first, second)))
				.isEqualTo(ReplaceResult.APPLIED);

		assertThat(repository.closeCurrentScreen(data.email(), 7L, 18L))
				.isEqualTo(CloseResult.CLOSED);

		assertThat(isSubscribed(data.email(), 1, first)).isFalse();
		assertThat(isSubscribed(data.email(), 1, second)).isFalse();
		assertThat(repository.findMeta(data.email())).isEmpty();
	}

	@Test
	@DisplayName("셀별 인원수 화면을 닫으면 화면 사용자 목록과 화면 정보를 지운다")
	void closesClusteredSubscriptionAndMeta() {
		TestData data = testData();
		connect(data.email(), 7L);
		ViewportRange viewport = new ViewportRange(1, -2.0, 2.0, -2.0, 2.0, List.of());
		trackClustered(1);
		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 20L, viewport, ViewportMode.CLUSTERED, Set.of()))
				.isEqualTo(ReplaceResult.APPLIED);

		assertThat(repository.closeCurrentScreen(data.email(), 7L, 20L))
				.isEqualTo(CloseResult.CLOSED);

		assertThat(isClustered(data.email(), 1)).isFalse();
		assertThat(repository.findMeta(data.email())).isEmpty();
	}

	@Test
	@DisplayName("이전 화면의 늦은 닫기는 현재 화면을 유지한다")
	void oldCloseKeepsCurrentScreen() {
		TestData data = testData();
		connect(data.email(), 7L);
		ViewportRange viewport = new ViewportRange(1, -2.0, 2.0, -2.0, 2.0, List.of());
		Cell cell = new Cell(3, 3);
		trackCell(1, cell);
		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 22L, viewport, ViewportMode.INDIVIDUAL, Set.of(cell)))
				.isEqualTo(ReplaceResult.APPLIED);

		assertThat(repository.closeCurrentScreen(data.email(), 7L, 21L))
				.isEqualTo(CloseResult.OLD_REQUEST);

		assertThat(isSubscribed(data.email(), 1, cell)).isTrue();
		assertThat(repository.findMeta(data.email())).isPresent();
	}

	@Test
	@DisplayName("이전 접속의 늦은 닫기는 현재 화면을 유지한다")
	void staleCloseKeepsCurrentScreen() {
		TestData data = testData();
		connect(data.email(), 7L);
		ViewportRange viewport = new ViewportRange(1, -2.0, 2.0, -2.0, 2.0, List.of());
		Cell cell = new Cell(4, 4);
		trackCell(1, cell);
		assertThat(repository.replaceSubscriptions(
				data.email(), 7L, 24L, viewport, ViewportMode.INDIVIDUAL, Set.of(cell)))
				.isEqualTo(ReplaceResult.APPLIED);

		assertThat(repository.closeCurrentScreen(data.email(), 6L, 24L))
				.isEqualTo(CloseResult.STALE_CONNECTION);

		assertThat(isSubscribed(data.email(), 1, cell)).isTrue();
		assertThat(repository.findMeta(data.email())).isPresent();
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

	private void trackClustered(int layer) {
		keysToDelete.add(clusteredKey(layer));
	}

	private boolean isSubscribed(String email, int layer, Cell cell) {
		return Boolean.TRUE.equals(redis.opsForSet().isMember(cellKey(layer, cell), email));
	}

	private boolean isClustered(String email, int layer) {
		return Boolean.TRUE.equals(redis.opsForSet().isMember(clusteredKey(layer), email));
	}

	private static String cellKey(int layer, Cell cell) {
		return "viewport:cell:" + layer + ":" + cell.cellX() + ":" + cell.cellY();
	}

	private static String clusteredKey(int layer) {
		return "viewport:clustered:" + layer;
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
