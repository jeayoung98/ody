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
import com.ssafy.backend.realtime.dto.ride.RidePanelTab;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.PanelSnapshot;

/** 실제 Redis에서 인솔자가 열어 둔 곡 상세 저장·읽기·지우기를 검증한다. */
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
class RidePanelRedisIntegrationTests {

	private static final long MUSIC_ID = 4927L;

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
				redis, scripts.rideMountScript(), scripts.rideDismountScript());
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
	@DisplayName("저장한 곡과 탭이 그대로 다시 읽힌다")
	void saveAndRead() {
		String captain = user();

		repository.savePanel(captain, MUSIC_ID, RidePanelTab.INFO);

		PanelSnapshot saved = repository.findPanel(captain);
		assertThat(saved.musicId()).isEqualTo(MUSIC_ID);
		assertThat(saved.tab()).isEqualTo(RidePanelTab.INFO);
	}

	/** 닫힌 상태는 값이 아니라 키가 없는 것으로 나타낸다. */
	@Test
	@DisplayName("열어 둔 적이 없으면 아무것도 읽히지 않는다")
	void missingPanelIsNull() {
		assertThat(repository.findPanel(user())).isNull();
	}

	@Test
	@DisplayName("탭만 바꿔도 새 탭으로 덮어쓴다")
	void tabIsOverwritten() {
		String captain = user();

		repository.savePanel(captain, MUSIC_ID, RidePanelTab.NEARBY);
		repository.savePanel(captain, MUSIC_ID, RidePanelTab.PLAYLISTS);

		assertThat(repository.findPanel(captain).tab()).isEqualTo(RidePanelTab.PLAYLISTS);
	}

	@Test
	@DisplayName("다른 곡을 열면 곡도 같이 바뀐다")
	void musicIsOverwritten() {
		String captain = user();

		repository.savePanel(captain, MUSIC_ID, RidePanelTab.INFO);
		repository.savePanel(captain, 10877L, RidePanelTab.INFO);

		assertThat(repository.findPanel(captain).musicId()).isEqualTo(10877L);
	}

	/** 키가 남으면 다음에 탄 사람이 이미 닫힌 패널을 열린 것으로 본다. */
	@Test
	@DisplayName("닫으면 키가 사라진다")
	void closeRemovesKey() {
		String captain = user();
		repository.savePanel(captain, MUSIC_ID, RidePanelTab.INFO);

		repository.deletePanel(captain);

		assertThat(repository.findPanel(captain)).isNull();
		assertThat(redis.hasKey("ride:panel:" + captain)).isFalse();
	}

	@Test
	@DisplayName("열어 둔 적이 없는데 닫아도 터지지 않는다")
	void closeWithoutOpenIsSafe() {
		String captain = user();

		repository.deletePanel(captain);

		assertThat(repository.findPanel(captain)).isNull();
	}

	/** 프론트가 새 탭을 먼저 내보내면 서버가 모르는 값이 들어올 수 있다. */
	@Test
	@DisplayName("모르는 탭이 저장돼 있으면 닫힌 것으로 본다")
	void unknownStoredTabReadsAsClosed() {
		String captain = user();
		redis.opsForHash().put("ride:panel:" + captain, "musicId", Long.toString(MUSIC_ID));
		redis.opsForHash().put("ride:panel:" + captain, "tab", "lyrics");

		assertThat(repository.findPanel(captain)).isNull();
	}

	private String user() {
		String email = "ride-panel-it-" + UUID.randomUUID() + "@test.local";
		keysToDelete.add("ride:panel:" + email);
		return email;
	}

	private static String env(String name, String fallback) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? fallback : value;
	}
}
