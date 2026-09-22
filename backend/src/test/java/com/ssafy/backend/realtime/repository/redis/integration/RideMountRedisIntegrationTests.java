package com.ssafy.backend.realtime.repository.redis.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
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
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountStatus;

/** 실제 Redis에서 따라가기 자격 확인과 등록을 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class RideMountRedisIntegrationTests {

	private static final int MAX_RIDERS = 20;

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
	@DisplayName("따라가기가 성립하면 두 키가 같이 생긴다")
	void mountCreatesBothKeys() {
		String captain = user();
		String rider = user();
		placeOnMusic(captain, 3L, 10877L, 2);
		connect(rider, 5L);

		MountResult result = repository.mount(rider, captain, 5L, MAX_RIDERS);

		assertThat(result.status()).isEqualTo(MountStatus.OK);
		assertThat(result.musicId()).isEqualTo(10877L);
		assertThat(result.layer()).isEqualTo(2);
		assertThat(captainOf(rider)).isEqualTo(captain);
		assertThat(riderEpochOf(rider)).isEqualTo("5");
		assertThat(repository.riders(captain)).containsExactly(rider);
	}

	@Test
	@DisplayName("곡 위에 없는 사람은 따라갈 수 없다")
	void inactiveCaptainIsRejected() {
		String captain = user();
		String rider = user();
		connect(captain, 3L); // 접속만 하고 아직 곡을 틀지 않았다
		connect(rider, 5L);

		assertThat(repository.mount(rider, captain, 5L, MAX_RIDERS).status())
				.isEqualTo(MountStatus.CAPTAIN_INACTIVE);
		assertThat(captainOf(rider)).isNull();
		assertThat(repository.riders(captain)).isEmpty();
	}

	@Test
	@DisplayName("재연결 전 접속이 보낸 요청은 무시한다")
	void staleConnectionIsRejected() {
		String captain = user();
		String rider = user();
		placeOnMusic(captain, 3L, 10877L, 2);
		connect(rider, 9L); // 지금 접속은 9

		assertThat(repository.mount(rider, captain, 8L, MAX_RIDERS).status())
				.isEqualTo(MountStatus.STALE);
		assertThat(captainOf(rider)).isNull();
	}

	@Test
	@DisplayName("이미 따라가는 중이면 갈아타지 않는다")
	void alreadyRidingIsRejected() {
		String first = user();
		String second = user();
		String rider = user();
		placeOnMusic(first, 3L, 10877L, 2);
		placeOnMusic(second, 3L, 20999L, 4);
		connect(rider, 5L);

		assertThat(repository.mount(rider, first, 5L, MAX_RIDERS).status()).isEqualTo(MountStatus.OK);

		assertThat(repository.mount(rider, second, 5L, MAX_RIDERS).status())
				.isEqualTo(MountStatus.ALREADY_RIDING);
		assertThat(captainOf(rider)).isEqualTo(first);
		assertThat(repository.riders(second)).isEmpty();
	}

	@Test
	@DisplayName("따라오는 사람이 있으면 다른 사람을 따라갈 수 없다")
	void riderWithOwnRidersIsRejected() {
		String captain = user();
		String middle = user();
		String tail = user();
		placeOnMusic(captain, 3L, 10877L, 2);
		placeOnMusic(middle, 3L, 20999L, 4);
		connect(tail, 7L);

		assertThat(repository.mount(tail, middle, 7L, MAX_RIDERS).status()).isEqualTo(MountStatus.OK);

		assertThat(repository.mount(middle, captain, 3L, MAX_RIDERS).status())
				.isEqualTo(MountStatus.CHAIN);
		assertThat(captainOf(middle)).isNull();
	}

	@Test
	@DisplayName("남을 따라가는 중인 사람은 따라갈 수 없다")
	void ridingTargetIsRejected() {
		String captain = user();
		String middle = user();
		String tail = user();
		placeOnMusic(captain, 3L, 10877L, 2);
		placeOnMusic(middle, 4L, 20999L, 4);
		connect(tail, 7L);

		assertThat(repository.mount(middle, captain, 4L, MAX_RIDERS).status()).isEqualTo(MountStatus.OK);

		assertThat(repository.mount(tail, middle, 7L, MAX_RIDERS).status())
				.isEqualTo(MountStatus.CHAIN);
		assertThat(captainOf(tail)).isNull();
		assertThat(repository.riders(middle)).isEmpty();
	}

	@Test
	@DisplayName("자리가 차면 더 태우지 않는다")
	void fullFleetIsRejected() {
		String captain = user();
		placeOnMusic(captain, 3L, 10877L, 2);
		int limit = 3; // 상한 자체가 지켜지는지만 본다. 20 을 다 채울 필요는 없다
		for (int i = 0; i < limit; i++) {
			String rider = user();
			connect(rider, 5L);
			assertThat(repository.mount(rider, captain, 5L, limit).status()).isEqualTo(MountStatus.OK);
		}

		String late = user();
		connect(late, 5L);

		assertThat(repository.mount(late, captain, 5L, limit).status()).isEqualTo(MountStatus.FULL);
		assertThat(captainOf(late)).isNull();
		assertThat(repository.riderCount(captain)).isEqualTo(limit);
	}

	/**
	 * 확인과 등록이 갈라져 있으면 한 사람이 두 선단에 동시에 들어간다.
	 * 그 상태는 하차로도 풀리지 않는다 — ride:captain 이 하나뿐이라 한쪽 선단에 유령이 남는다.
	 */
	@Test
	@DisplayName("동시에 두 사람을 따라가면 하나만 성립한다")
	void concurrentMountsPickOnlyOne() throws Exception {
		String first = user();
		String second = user();
		String rider = user();
		placeOnMusic(first, 3L, 10877L, 2);
		placeOnMusic(second, 3L, 20999L, 4);
		connect(rider, 5L);

		CyclicBarrier startTogether = new CyclicBarrier(2);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			Future<MountStatus> a = pool.submit(mountTask(startTogether, rider, first));
			Future<MountStatus> b = pool.submit(mountTask(startTogether, rider, second));
			List<MountStatus> results = List.of(a.get(), b.get());

			assertThat(results).containsExactlyInAnyOrder(MountStatus.OK, MountStatus.ALREADY_RIDING);
		} finally {
			pool.shutdownNow();
		}

		String winner = captainOf(rider);
		assertThat(winner).isIn(first, second);
		String loser = winner.equals(first) ? second : first;
		assertThat(repository.riders(winner)).containsExactly(rider);
		assertThat(repository.riders(loser)).isEmpty();
	}

	private Callable<MountStatus> mountTask(CyclicBarrier barrier, String rider, String captain) {
		return () -> {
			barrier.await();
			return repository.mount(rider, captain, 5L, MAX_RIDERS).status();
		};
	}

	/** 접속만 한 상태. 곡 위에는 없다. */
	private void connect(String email, long epoch) {
		String key = "presence:user:" + email;
		keysToDelete.add(key);
		keysToDelete.add("ride:captain:" + email);
		keysToDelete.add("ride:riders:" + email);
		keysToDelete.add("ride:playback:" + email);
		redis.opsForHash().put(key, "epoch", Long.toString(epoch));
	}

	/** 곡 위에 서 있는 상태. 따라갈 수 있는 사람이 된다. */
	private void placeOnMusic(String email, long epoch, long musicId, int layer) {
		connect(email, epoch);
		String key = "presence:user:" + email;
		redis.opsForHash().put(key, "musicId", Long.toString(musicId));
		redis.opsForHash().put(key, "layer", Integer.toString(layer));
	}

	private String captainOf(String rider) {
		Object value = redis.opsForHash().get("ride:captain:" + rider, "captain");
		return value == null ? null : value.toString();
	}

	private String riderEpochOf(String rider) {
		Object value = redis.opsForHash().get("ride:captain:" + rider, "epoch");
		return value == null ? null : value.toString();
	}

	private String user() {
		return "ride-it-" + UUID.randomUUID() + "@test.local";
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}
}
