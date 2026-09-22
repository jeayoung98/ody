package com.ssafy.backend.realtime.repository.redis.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

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
import org.springframework.test.util.ReflectionTestUtils;

import com.ssafy.backend.realtime.config.RedisScriptConfig;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.repository.mapper.PlayHistoryMapper;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.LeaveResult;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.presence.PresenceService;
import com.ssafy.backend.realtime.service.ride.RideService;
import com.ssafy.backend.realtime.service.ride.RiderMoveService;

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

		assertThat(repository.applyLeave(data.email(), 1L).removed()).containsExactly(
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
				mock(PlayHistoryMapper.class),
				mock(RideService.class),
				mock(RiderMoveService.class));
		ReflectionTestUtils.setField(service, "ttlMs", 60_000L);

		// 다른 탭이 남아 있지 않은 재연결이므로 이전 위치를 지운다.
		service.connect(data.email(), 2L);

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

	/** 탭을 여러 개 켜도 마지막 것만 산다. 앞의 탭 자리를 남겨 두면 지도에 유령이 생긴다. */
	@Test
	@DisplayName("앞의 탭이 남아 있어도 이전 위치와 곡 인덱스를 지운다")
	void connectAlwaysClearsPreviousPosition() {
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
				mock(PlayHistoryMapper.class),
				mock(RideService.class),
				mock(RiderMoveService.class));
		ReflectionTestUtils.setField(service, "ttlMs", 60_000L);

		// 앞의 탭이 남아 있든 아니든 새 접속은 새 출발이다.
		service.connect(data.email(), 2L);

		assertThat(repository.snapshot(data.email()))
				.isEqualTo(new PresenceSnapshot(null, null, null, null, 2L));
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isFalse();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer1() + ":" + data.music1(), data.email())).isFalse();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isNull();
		// 지도에서 사라졌으니 퇴장도 알린다.
		verify(eventService).send(new PositionChanged(
				data.email(), 1L, data.layer1(), null,
				data.music1(), null,
				"3:4", null,
				null, null));
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

	/** 앞의 탭이 닫힌 것뿐이다. 아무것도 안 건드렸다는 사실을 부르는 쪽이 알아야 한다. */
	@Test
	@DisplayName("이전 접속의 종료 요청은 건너뛴 것으로 알린다")
	void staleLeaveReportsSkipped() {
		TestData data = testData();
		connect(data.email(), 2L);

		assertThat(repository.applyLeave(data.email(), 1L).applied()).isFalse();
	}

	/** 만료 목록을 읽은 뒤 하트비트가 도착했다. 아직 살아 있다. */
	@Test
	@DisplayName("아직 만료되지 않았으면 건너뛴 것으로 알린다")
	void notExpiredReportsSkipped() {
		TestData data = testData();
		long sweepTime = System.currentTimeMillis();
		connect(data.email(), 1L);
		redis.opsForZSet().add("presence:expiry", data.email(), sweepTime + 60_000);

		assertThat(repository.applyLeaveExpired(data.email(), sweepTime).applied()).isFalse();
	}

	@Test
	@DisplayName("자리에 없던 사용자를 지워도 정리한 것으로 알린다")
	void leaveWithoutSpotIsStillApplied() {
		TestData data = testData();
		connect(data.email(), 1L);

		assertThat(repository.applyLeave(data.email(), 1L).applied()).isTrue();
		assertThat(repository.applyLeave(data.email(), 1L).removed()).isEmpty();
	}

	/** 화면을 연 접속 번호가 뒤처져 있어도 지워야 한다. 남기면 끊긴 사람에게 계속 보낸다. */
	@Test
	@DisplayName("화면을 연 접속 번호가 지금과 달라도 구독을 지운다")
	void leaveRemovesViewportSubscriptionsOfOlderEpoch() {
		TestData data = testData();
		String metaKey = key("viewport:meta:" + data.email());
		String cellKey = key("viewport:cell:" + data.layer1() + ":7:8");
		connect(data.email(), 5L);
		redis.opsForHash().putAll(metaKey, java.util.Map.of(
				"epoch", "4", "requestSeq", "30", "layer", Integer.toString(data.layer1()),
				"mode", "INDIVIDUAL", "cellKeys", "7:8"));
		redis.opsForSet().add(cellKey, data.email());

		repository.applyLeave(data.email(), 5L);

		assertThat(redis.opsForSet().isMember(cellKey, data.email())).isFalse();
		assertThat(redis.hasKey(metaKey)).isFalse();
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

	// ── 따라가는 사람은 지도에 없다 ─────────────────────────

	@Test
	@DisplayName("따라가기 첫 배치는 지도에서 빼고 표시를 남긴다")
	void firstRidePlacementLeavesTheMap() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		trackJoinKeys(data.email(), data.music2(), data.layer1(), "5:6");
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(repository.applyRidePlacement(data.email(), 1L,
				data.music1(), data.layer1(), 3, 4,
				data.music2(), data.layer1(), 0.5, 0.6, 5, 6)).isTrue();

		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), data.email())).isFalse();
		assertThat(redis.opsForSet().isMember(
				"layer-listeners:" + data.layer1() + ":" + data.music2(), data.email())).isFalse();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isNull();
		assertThat(redis.opsForHash().get("presence:user:" + data.email(), "riding")).isEqualTo("1");
	}

	/** 인솔자가 곡을 바꿀 때마다 도는 자리다. 이미 지도에 없는데 또 빼면 남의 인원수가 깎인다. */
	@Test
	@DisplayName("따라가는 동안 곡을 옮겨도 남의 셀 인원수를 깎지 않는다")
	void ridePlacementDoesNotTouchCountsAfterFirstMove() {
		TestData data = testData();
		String other = "presence-it-other-" + UUID.randomUUID() + "@test.local";
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		trackJoinKeys(other, data.music1(), data.layer1(), "3:4");
		trackJoinKeys(data.email(), data.music2(), data.layer1(), "5:6");
		connect(data.email(), 1L);
		connect(other, 1L);
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();
		assertThat(repository.join(other, 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();
		// 첫 배치로 지도에서 빠진다. 남은 사람은 other 하나.
		assertThat(repository.applyRidePlacement(data.email(), 1L,
				data.music1(), data.layer1(), 3, 4,
				data.music2(), data.layer1(), 0.5, 0.6, 5, 6)).isTrue();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isEqualTo("1");

		// 인솔자가 다시 곡을 바꿔 따라가는 사람도 옮긴다.
		assertThat(repository.applyRidePlacement(data.email(), 1L,
				data.music2(), data.layer1(), 5, 6,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isEqualTo("1");
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), other)).isTrue();
	}

	/** 지도에 없던 사람이다. 빼면 인솔자 셀이 깎이고 보인 적 없는 사람의 퇴장이 나간다. */
	@Test
	@DisplayName("따라가는 사람이 끊겨도 그 자리의 인원수는 그대로다")
	void leavingWhileRidingKeepsCounts() {
		TestData data = testData();
		String captain = "presence-it-captain-" + UUID.randomUUID() + "@test.local";
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		trackJoinKeys(captain, data.music1(), data.layer1(), "3:4");
		trackJoinKeys(data.email(), data.music2(), data.layer1(), "5:6");
		connect(data.email(), 1L);
		connect(captain, 1L);
		assertThat(repository.join(captain, 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music2(), data.layer1(), 0.5, 0.6, 5, 6)).isTrue();
		// 인솔자 자리로 옮겨 붙는다. 지도에는 안 들어간다.
		assertThat(repository.applyRidePlacement(data.email(), 1L,
				data.music2(), data.layer1(), 5, 6,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();

		LeaveResult result = repository.applyLeave(data.email(), 1L);

		assertThat(result.applied()).isTrue();
		// 뺄 자리가 없으니 퇴장 알림도 나가지 않는다.
		assertThat(result.removed()).isEmpty();
		assertThat(redis.opsForHash().get("cell:usercount:" + data.layer1(), "3:4")).isEqualTo("1");
		assertThat(redis.opsForSet().isMember("listeners:" + data.music1(), captain)).isTrue();
	}

	@Test
	@DisplayName("따라가는 중에는 재생 요청을 거부한다")
	void playWhileRidingIsRejected() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		trackJoinKeys(data.email(), data.music2(), data.layer1(), "5:6");
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();
		assertThat(repository.applyRidePlacement(data.email(), 1L,
				data.music1(), data.layer1(), 3, 4,
				data.music2(), data.layer1(), 0.5, 0.6, 5, 6)).isTrue();

		assertThat(repository.applyPlay(data.email(),
				data.music2(), data.layer1(), 5, 6,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isNull();
	}

	@Test
	@DisplayName("따라가는 중에는 입장 요청을 거부한다")
	void joinWhileRidingIsRejected() {
		TestData data = testData();
		trackJoinKeys(data.email(), data.music1(), data.layer1(), "3:4");
		trackJoinKeys(data.email(), data.music2(), data.layer1(), "5:6");
		connect(data.email(), 1L);
		assertThat(repository.join(data.email(), 1L, null, null, null, null,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isTrue();
		assertThat(repository.applyRidePlacement(data.email(), 1L,
				data.music1(), data.layer1(), 3, 4,
				data.music2(), data.layer1(), 0.5, 0.6, 5, 6)).isTrue();

		assertThat(repository.join(data.email(), 1L,
				data.music2(), data.layer1(), 5, 6,
				data.music1(), data.layer1(), 0.3, 0.4, 3, 4)).isFalse();
	}

	private void connect(String email, long epoch) {
		key("presence:user:" + email);
		expiryEmails.add(email);
		repository.connect(email, epoch, 60_000L);
	}

	// ── 접속 여부 ─────────────────────────────────────────

	@Test
	@DisplayName("접속하면 접속 중으로, 나가면 아닌 것으로 읽힌다")
	void connectedFlipsOnLeave() {
		TestData data = testData();
		key("presence:user:" + data.email());
		expiryEmails.add(data.email());

		assertThat(repository.isConnected(data.email())).isFalse();

		repository.connect(data.email(), 1L, 45_000L);
		assertThat(repository.isConnected(data.email())).isTrue();

		repository.applyLeave(data.email(), 1L);
		assertThat(repository.isConnected(data.email())).isFalse();
	}

	@Test
	@DisplayName("여러 사람을 한 번에 물으면 접속한 사람만 담긴다")
	void connectedOfKeepsOnlyOnline() {
		TestData online = testData();
		TestData offline = testData();
		key("presence:user:" + online.email());
		key("presence:user:" + offline.email());
		expiryEmails.add(online.email());

		repository.connect(online.email(), 1L, 45_000L);

		assertThat(repository.connectedOf(List.of(online.email(), offline.email())))
				.containsOnlyKeys(online.email())
				.containsEntry(online.email(), true);
	}

	/** 빈 입력에 Redis 를 다녀오면 목록이 비었을 때마다 헛걸음을 한다. */
	@Test
	@DisplayName("빈 목록이면 읽지 않는다")
	void connectedOfSkipsEmptyInput() {
		assertThat(repository.connectedOf(List.of())).isEmpty();
		assertThat(repository.connectedOf(null)).isEmpty();
	}

	/** 같은 사람이 목록에 두 번 들어와도 한 번만 묻고 한 칸만 돌려준다. */
	@Test
	@DisplayName("같은 사람이 겹쳐 들어와도 한 번만 센다")
	void connectedOfDeduplicates() {
		TestData data = testData();
		key("presence:user:" + data.email());
		expiryEmails.add(data.email());
		repository.connect(data.email(), 1L, 45_000L);

		assertThat(repository.connectedOf(List.of(data.email(), data.email())))
				.hasSize(1)
				.containsEntry(data.email(), true);
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
