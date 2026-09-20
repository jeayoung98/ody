package com.ssafy.backend.realtime.repository.redis.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

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
import org.springframework.test.util.ReflectionTestUtils;

import com.ssafy.backend.realtime.config.RedisScriptConfig;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.repository.mapper.PlayHistoryMapper;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.presence.PresenceService;

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
				scripts.presenceLeaveScript(), scripts.usercountRecountScript(),
				scripts.ridePlaceScript());
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

		assertThat(repository.join(data.email(), 1L, null, null, null, null,
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
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.join(data.email(), 1L, data.music1(), data.layer1(), 3, 4,
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
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();
		assertThat(repository.join(remainingEmail, 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.join(data.email(), 1L, data.music1(), data.layer1(), 3, 4,
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
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.join(data.email(), 1L, data.music1(), data.layer1(), 3, 4,
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
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.join(data.email(), 1L, data.music2(), data.layer1(), 3, 4,
				data.music2(), data.layer2(), 0.7, 0.8, 7, 8)).isFalse();

		assertThat(repository.snapshot(data.email())).isEqualTo(
				new PresenceSnapshot(data.music1(), data.layer1(), 3, 4, 1L));
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isTrue();
		assertThat(redis.opsForSet().isMember("listeners:" + data.music2(), data.email())).isFalse();
	}

	@Test
	@DisplayName("이전 소켓의 입장 요청은 현재 위치를 바꾸지 않는다")
	void staleConnectionJoinKeepsCurrentState() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		connect(data.email(), 2L);

		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isFalse();

		assertThat(repository.snapshot(data.email()))
				.isEqualTo(new PresenceSnapshot(null, null, null, null, 2L));
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isFalse();
	}

	@Test
	@DisplayName("접속 상태가 없으면 배치 자료를 만들지 않는다")
	void missingPresenceRejectsJoin() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");

		assertThat(repository.join(data.email(), 1L, null, null, null, null,
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
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();
		assertThat(repository.join(remainingEmail, 1L, null, null, null, null,
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
	@DisplayName("다시 연결하면 이전 위치와 구독을 지우고 비노출 상태로 시작한다")
	void reconnectRemovesOldPositionBeforeCreatingNewPresence() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		RealtimeEventService eventService = mock(RealtimeEventService.class);
		PresenceService service = new PresenceService(
				repository,
				mock(MusicLocationService.class),
				mock(MusicPositionCalculator.class),
				eventService,
				mock(PlayHistoryMapper.class));
		ReflectionTestUtils.setField(service, "ttlMs", 60_000L);

		// 다른 탭이 남아 있지 않은 재연결이므로 이전 위치를 지운다.
		service.connect(data.email(), 2L, false);

		assertThat(repository.snapshot(data.email()))
				.isEqualTo(new PresenceSnapshot(null, null, null, null, 2L));
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isFalse();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer1() + ":" + data.music1(), data.email())).isFalse();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isNull();
		verify(eventService).send(new PositionChanged(
				data.email(), 1L, data.layer1(), null,
				data.music1(), null,
				"3:4", null,
				null, null));
	}

	@Test
	@DisplayName("다른 탭이 남아 있으면 이전 위치와 곡 인덱스를 그대로 둔다")
	void connectKeepsPositionWhenOtherTabRemains() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		RealtimeEventService eventService = mock(RealtimeEventService.class);
		PresenceService service = new PresenceService(
				repository,
				mock(MusicLocationService.class),
				mock(MusicPositionCalculator.class),
				eventService,
				mock(PlayHistoryMapper.class));
		ReflectionTestUtils.setField(service, "ttlMs", 60_000L);

		// 다른 탭이 살아 있으므로 접속 번호만 올리고 위치는 건드리지 않는다.
		service.connect(data.email(), 2L, true);

		// 곡과 셀이 남아 있어야 새 탭이 듣던 곡을 그대로 물려받는다.
		assertThat(repository.snapshot(data.email()))
				.isEqualTo(new PresenceSnapshot(data.music1(), data.layer1(), 3, 4, 2L));
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isTrue();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer1() + ":" + data.music1(), data.email())).isTrue();
		assertThat(redis.opsForSet().isMember(
				"active-song:cell:" + data.layer1() + ":3:4", Long.toString(data.music1()))).isTrue();
		assertThat(redis.opsForSet().isMember("active-song:cells:" + data.layer1(), "3:4")).isTrue();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isEqualTo("1");
		// 사라지지 않았으므로 퇴장 알림도 나가지 않는다.
		verifyNoInteractions(eventService);
	}

	@Test
	@DisplayName("직접 종료하면 화면 셀 구독과 화면 정보를 함께 지운다")
	void leaveRemovesViewportSubscriptions() {
		TestData data = testData();
		String metaKey = key("viewport:meta:" + data.email());
		String firstCellKey = key("viewport:cell:" + data.layer1() + ":1:2");
		String secondCellKey = key("viewport:cell:" + data.layer1() + ":3:4");
		connect(data.email(), 7L);
		redis.opsForHash().putAll(metaKey, java.util.Map.of(
				"epoch", "7", "requestSeq", "18", "layer", Integer.toString(data.layer1()),
				"mode", "INDIVIDUAL", "cellKeys", "1:2,3:4"));
		redis.opsForSet().add(firstCellKey, data.email());
		redis.opsForSet().add(secondCellKey, data.email());

		repository.applyLeave(data.email(), 7L);

		assertThat(redis.opsForSet().isMember(firstCellKey, data.email())).isFalse();
		assertThat(redis.opsForSet().isMember(secondCellKey, data.email())).isFalse();
		assertThat(redis.hasKey(metaKey)).isFalse();
	}

	@Test
	@DisplayName("접속이 만료되면 셀별 인원수 화면 구독도 지운다")
	void expiredLeaveRemovesClusteredViewportSubscription() {
		TestData data = testData();
		String metaKey = key("viewport:meta:" + data.email());
		String clusteredKey = key("viewport:clustered:" + data.layer1());
		long sweepTime = System.currentTimeMillis();
		connect(data.email(), 7L);
		redis.opsForZSet().add("presence:expiry", data.email(), sweepTime - 1);
		redis.opsForHash().putAll(metaKey, java.util.Map.of(
				"epoch", "7", "requestSeq", "20", "layer", Integer.toString(data.layer1()),
				"mode", "CLUSTERED", "cellKeys", ""));
		redis.opsForSet().add(clusteredKey, data.email());

		repository.applyLeaveExpired(data.email(), sweepTime);

		assertThat(redis.opsForSet().isMember(clusteredKey, data.email())).isFalse();
		assertThat(redis.hasKey(metaKey)).isFalse();
	}

	@Test
	@DisplayName("이전 접속의 종료 요청은 현재 화면 구독을 유지한다")
	void staleLeaveKeepsViewportSubscriptions() {
		TestData data = testData();
		String metaKey = key("viewport:meta:" + data.email());
		String cellKey = key("viewport:cell:" + data.layer1() + ":5:6");
		connect(data.email(), 2L);
		redis.opsForHash().putAll(metaKey, java.util.Map.of(
				"epoch", "2", "requestSeq", "22", "layer", Integer.toString(data.layer1()),
				"mode", "INDIVIDUAL", "cellKeys", "5:6"));
		redis.opsForSet().add(cellKey, data.email());

		repository.applyLeave(data.email(), 1L);

		assertThat(redis.opsForSet().isMember(cellKey, data.email())).isTrue();
		assertThat(redis.hasKey(metaKey)).isTrue();
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
