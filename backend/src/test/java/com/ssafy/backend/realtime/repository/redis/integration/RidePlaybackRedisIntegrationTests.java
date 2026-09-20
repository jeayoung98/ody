package com.ssafy.backend.realtime.repository.redis.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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
import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.PlaybackSnapshot;

/** 실제 Redis에서 재생 정보 저장·읽기와 발송 대상 목록을 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class RidePlaybackRedisIntegrationTests {

	private static final long MUSIC_ID = 10877L;

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

		repository = new RideRedisRepository(redis, new RedisScriptConfig().rideMountScript());
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
	@DisplayName("저장한 값이 그대로 다시 읽힌다")
	void saveAndRead() {
		String captain = user();

		long snapshotSeq = repository.savePlayback(
				captain, MUSIC_ID, PlaybackState.PAUSED, 32_000L, 1_700_000_000_000L);

		PlaybackSnapshot saved = repository.findPlayback(captain);
		assertThat(snapshotSeq).isEqualTo(1L);
		assertThat(saved.musicId()).isEqualTo(MUSIC_ID);
		assertThat(saved.state()).isEqualTo(PlaybackState.PAUSED);
		assertThat(saved.positionMs()).isEqualTo(32_000L);
		assertThat(saved.updatedAt()).isEqualTo(1_700_000_000_000L);
		assertThat(saved.snapshotSeq()).isEqualTo(1L);
	}

	@Test
	@DisplayName("저장한 적이 없으면 아무것도 읽히지 않는다")
	void missingPlaybackIsNull() {
		String captain = user();
		keysToDelete.add("ride:playback:" + captain);

		assertThat(repository.findPlayback(captain)).isNull();
	}

	/** 순번이 안 오르면 받는 쪽이 어느 값이 최신인지 가릴 수 없다. */
	@Test
	@DisplayName("바꿀 때마다 순번이 1씩 오른다")
	void snapshotSeqIncreases() {
		String captain = user();

		assertThat(repository.savePlayback(captain, MUSIC_ID, PlaybackState.PLAYING, 0L, 1_000L))
				.isEqualTo(1L);
		assertThat(repository.savePlayback(captain, MUSIC_ID, PlaybackState.PAUSED, 5_000L, 2_000L))
				.isEqualTo(2L);
		assertThat(repository.savePlayback(captain, MUSIC_ID, PlaybackState.PLAYING, 5_000L, 3_000L))
				.isEqualTo(3L);
		assertThat(repository.findPlayback(captain).snapshotSeq()).isEqualTo(3L);
	}

	/**
	 * 순번 올리기와 값 저장이 갈라져 있으면, 동시에 두 번 바꿀 때 한쪽 순번에 다른 쪽 값이 붙는다.
	 * 저장된 네 값이 모두 같은 한 번의 저장에서 온 것인지 본다.
	 */
	@Test
	@DisplayName("동시에 여러 번 바꿔도 값이 섞이지 않는다")
	void concurrentSavesKeepValuesTogether() throws Exception {
		String captain = user();
		keysToDelete.add("ride:playback:" + captain);
		int count = 20;

		CyclicBarrier startTogether = new CyclicBarrier(count);
		ExecutorService pool = Executors.newFixedThreadPool(count);
		try {
			List<Future<Long>> saved = new ArrayList<>();
			for (int i = 1; i <= count; i++) {
				saved.add(pool.submit(saveTask(startTogether, captain, i)));
			}
			for (Future<Long> future : saved) {
				future.get();
			}
		} finally {
			pool.shutdownNow();
		}

		PlaybackSnapshot last = repository.findPlayback(captain);
		assertThat(last.snapshotSeq()).isEqualTo(count);
		// 한 번의 저장은 곡·위치·시각을 같은 번호로 넣는다. 셋이 어긋나면 값이 섞인 것이다.
		assertThat(last.positionMs()).isEqualTo(last.musicId() * 1_000L);
		assertThat(last.updatedAt()).isEqualTo(last.musicId() * 10L);
	}

	@Test
	@DisplayName("틀고 있으면 지금 위치가 흐른 만큼 늘고, 멈춰 있으면 그대로다")
	void positionFollowsState() {
		String captain = user();
		long updatedAt = 1_700_000_000_000L;

		repository.savePlayback(captain, MUSIC_ID, PlaybackState.PLAYING, 30_000L, updatedAt);
		assertThat(repository.findPlayback(captain).positionAt(updatedAt + 12_000L))
				.isEqualTo(42_000L);

		repository.savePlayback(captain, MUSIC_ID, PlaybackState.PAUSED, 30_000L, updatedAt);
		assertThat(repository.findPlayback(captain).positionAt(updatedAt + 12_000L))
				.isEqualTo(30_000L);
	}

	@Test
	@DisplayName("따라오는 사람이 없으면 보낼 곳도 없다")
	void noRiders() {
		String captain = user();

		assertThat(repository.riders(captain)).isEmpty();
		assertThat(repository.riderCount(captain)).isZero();
	}

	@Test
	@DisplayName("따라오는 사람이 한 명이면 그 한 명만 나온다")
	void singleRider() {
		String captain = user();
		String rider = user();
		addRider(captain, rider);

		assertThat(repository.riders(captain)).containsExactly(rider);
		assertThat(repository.riderCount(captain)).isEqualTo(1);
	}

	/** 정원까지 태워도 발송 대상은 한 번에 다 읽힌다. */
	@Test
	@DisplayName("정원인 스무 명이 모두 발송 대상으로 나온다")
	void fullFleetRiders() {
		String captain = user();
		Set<String> riders = new LinkedHashSet<>();
		for (int i = 0; i < 20; i++) {
			String rider = user();
			riders.add(rider);
			addRider(captain, rider);
		}

		assertThat(repository.riders(captain)).containsExactlyInAnyOrderElementsOf(riders);
		assertThat(repository.riderCount(captain)).isEqualTo(20);
	}

	private Callable<Long> saveTask(CyclicBarrier barrier, String captain, int index) {
		return () -> {
			barrier.await();
			// 곡 번호 하나로 위치와 시각을 만들어, 나중에 셋이 같은 저장에서 왔는지 볼 수 있게 한다.
			return repository.savePlayback(captain, index, PlaybackState.PLAYING,
					index * 1_000L, index * 10L);
		};
	}

	private void addRider(String captain, String rider) {
		keysToDelete.add("ride:riders:" + captain);
		keysToDelete.add("ride:captain:" + rider);
		redis.opsForSet().add("ride:riders:" + captain, rider);
	}

	private String user() {
		String email = "ride-pb-it-" + UUID.randomUUID() + "@test.local";
		keysToDelete.add("ride:playback:" + email);
		keysToDelete.add("ride:riders:" + email);
		keysToDelete.add("ride:captain:" + email);
		return email;
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}
}
