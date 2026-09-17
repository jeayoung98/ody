package com.ssafy.backend.realtime.repository.redis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisSetCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.serializer.RedisSerializer;

import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.geometry.ViewportRange.LayerBound;
import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.CloseResult;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ReplaceResult;

/** 화면 구독 스크립트에 전달하는 값과 결과를 검증한다. */
@SuppressWarnings("unchecked")
class ViewportRedisRepositoryTests {

	private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
	private final DefaultRedisScript<Long> replaceScript = mock(DefaultRedisScript.class);
	private final DefaultRedisScript<Long> closeScript = mock(DefaultRedisScript.class);
	private ViewportRedisRepository repository;

	@BeforeEach
	void setUp() {
		repository = new ViewportRedisRepository(redis, replaceScript, closeScript);
	}

	@Test
	@DisplayName("화면 구독 교체에 접속 버전과 화면 범위와 셀을 전달한다")
	void replaceSubscriptionsPassesScreenAndCells() {
		ViewportRange viewport = new ViewportRange(3, -1.0, 1.0, -2.0, 2.0,
				List.of(
						new LayerBound(1, -3.0, 3.0, -4.0, 4.0),
						new LayerBound(2, -5.0, 5.0, -6.0, 6.0)));
		Set<Cell> cells = Set.of(new Cell(3, 4), new Cell(1, 2));
		when(redis.execute(replaceScript,
				List.of("presence:user:user@x.com", "viewport:meta:user@x.com"),
				"user@x.com", "7", "11", "3",
				"-1.0", "1.0", "-2.0", "2.0",
				"1|-3.0|3.0|-4.0|4.0;2|-5.0|5.0|-6.0|6.0",
				"INDIVIDUAL", "1:2,3:4", "viewport:cell:", "viewport:clustered:"))
				.thenReturn(1L);

		ReplaceResult result = repository.replaceSubscriptions(
				"user@x.com", 7L, 11L, viewport, ViewportMode.INDIVIDUAL, cells);

		assertThat(result).isEqualTo(ReplaceResult.APPLIED);
		verify(redis).execute(replaceScript,
				List.of("presence:user:user@x.com", "viewport:meta:user@x.com"),
				"user@x.com", "7", "11", "3",
				"-1.0", "1.0", "-2.0", "2.0",
				"1|-3.0|3.0|-4.0|4.0;2|-5.0|5.0|-6.0|6.0",
				"INDIVIDUAL", "1:2,3:4", "viewport:cell:", "viewport:clustered:");
	}

	@Test
	@DisplayName("오래된 화면 요청과 이전 접속을 구분한다")
	void distinguishesOldRequestAndStaleConnection() {
		ViewportRange viewport = new ViewportRange(1, -1.0, 1.0, -1.0, 1.0, List.of());
		List<String> keys = List.of("presence:user:user@x.com", "viewport:meta:user@x.com");
		Object[] args = {
				"user@x.com", "7", "2", "1",
				"-1.0", "1.0", "-1.0", "1.0", "",
				"INDIVIDUAL", "0:0", "viewport:cell:", "viewport:clustered:"
		};
		when(redis.execute(replaceScript, keys, args)).thenReturn(0L, -1L);

		assertThat(repository.replaceSubscriptions(
				"user@x.com", 7L, 2L, viewport,
				ViewportMode.INDIVIDUAL, Set.of(new Cell(0, 0))))
				.isEqualTo(ReplaceResult.OLD_REQUEST);
		assertThat(repository.replaceSubscriptions(
				"user@x.com", 7L, 2L, viewport,
				ViewportMode.INDIVIDUAL, Set.of(new Cell(0, 0))))
				.isEqualTo(ReplaceResult.STALE_CONNECTION);
	}

	@Test
	@DisplayName("화면을 닫을 때 접속 번호와 마지막 요청 순번을 전달한다")
	void closesCurrentScreenWithConnectionAndRequestSequence() {
		when(redis.execute(closeScript,
				List.of("presence:user:user@x.com", "viewport:meta:user@x.com"),
				"user@x.com", "7", "11", "viewport:cell:", "viewport:clustered:"))
				.thenReturn(1L);

		CloseResult result = repository.closeCurrentScreen("user@x.com", 7L, 11L);

		assertThat(result).isEqualTo(CloseResult.CLOSED);
		verify(redis).execute(closeScript,
				List.of("presence:user:user@x.com", "viewport:meta:user@x.com"),
				"user@x.com", "7", "11", "viewport:cell:", "viewport:clustered:");
	}

	@Test
	@DisplayName("이전 화면 닫기와 이전 접속을 구분한다")
	void distinguishesOldCloseAndStaleConnection() {
		List<String> keys = List.of("presence:user:user@x.com", "viewport:meta:user@x.com");
		Object[] args = {"user@x.com", "7", "11", "viewport:cell:", "viewport:clustered:"};
		when(redis.execute(closeScript, keys, args)).thenReturn(0L, -1L);

		assertThat(repository.closeCurrentScreen("user@x.com", 7L, 11L))
				.isEqualTo(CloseResult.OLD_REQUEST);
		assertThat(repository.closeCurrentScreen("user@x.com", 7L, 11L))
				.isEqualTo(CloseResult.STALE_CONNECTION);
	}

	@Test
	@DisplayName("여러 기본 셀의 사용자 수를 한 번에 읽고 빈 셀은 뺀다")
	void readsUserCountsByCellAtOnce() {
		HashOperations<String, Object, Object> hash = mock(HashOperations.class);
		when(redis.opsForHash()).thenReturn(hash);
		List<Cell> cells = List.of(new Cell(1, 2), new Cell(3, 4), new Cell(5, 6));
		when(hash.multiGet("cell:usercount:2", List.of("1:2", "3:4", "5:6")))
				.thenReturn(java.util.Arrays.asList("3", null, "1"));

		Map<Cell, Integer> result = repository.findUserCountsByCell(2, cells);

		assertThat(result)
				.containsEntry(new Cell(1, 2), 3)
				.containsEntry(new Cell(5, 6), 1)
				.doesNotContainKey(new Cell(3, 4));
	}

	@Test
	@DisplayName("모든 레이어의 셀별 인원수 화면 사용자를 한 번에 읽는다")
	@SuppressWarnings({"rawtypes", "unchecked"})
	void readsCellCountUsersByLayerAtOnce() {
		when(redis.getStringSerializer()).thenReturn(RedisSerializer.string());
		when(redis.executePipelined(any(RedisCallback.class)))
				.thenReturn((List) List.of(
						Set.of("a@test.local"), Set.of(), Set.of("b@test.local")));

		Map<Integer, Set<String>> result = repository.findCellCountUsersByLayer(3);

		assertThat(result)
				.containsEntry(1, Set.of("a@test.local"))
				.containsEntry(3, Set.of("b@test.local"))
				.doesNotContainKey(2);
		verify(redis).executePipelined(any(RedisCallback.class));
	}

	@Test
	@DisplayName("여러 사용자의 화면 정보를 한 번에 읽고 없는 정보는 뺀다")
	@SuppressWarnings({"rawtypes", "unchecked"})
	void readsViewportMetaByEmailsAtOnce() {
		when(redis.getStringSerializer()).thenReturn(RedisSerializer.string());
		Map<String, String> fields = Map.of(
				"epoch", "7",
				"requestSeq", "11",
				"mode", "CLUSTERED",
				"layer", "1",
				"minX", "0.0",
				"maxX", "2.0",
				"minY", "0.0",
				"maxY", "2.0",
				"ancestorBounds", "",
				"cellKeys", "");
		when(redis.executePipelined(any(RedisCallback.class)))
				.thenReturn((List) List.of(fields, Map.of()));

		Map<String, ViewportRedisRepository.ViewportMeta> result = repository.findMetaByEmails(
				Set.of("b@test.local", "a@test.local"));

		assertThat(result).containsOnlyKeys("a@test.local");
		assertThat(result.get("a@test.local").mode()).isEqualTo(ViewportMode.CLUSTERED);
		assertThat(result.get("a@test.local").requestSeq()).isEqualTo(11L);
		verify(redis).executePipelined(any(RedisCallback.class));
	}

	@Test
	@DisplayName("이전 셀과 새 셀을 지켜보는 사용자를 한 번에 읽는다")
	@SuppressWarnings({"rawtypes", "unchecked"})
	void readsOldAndNewCellSubscribersAtOnce() {
		RedisConnection connection = mock(RedisConnection.class);
		RedisSetCommands setCommands = mock(RedisSetCommands.class);
		when(connection.setCommands()).thenReturn(setCommands);
		when(redis.getStringSerializer()).thenReturn(RedisSerializer.string());
		when(redis.executePipelined(any(RedisCallback.class))).thenAnswer(invocation -> {
			RedisCallback callback = invocation.getArgument(0);
			callback.doInRedis(connection);
			return List.of(
					Set.of("old@test.local", "both@test.local"),
					Set.of("new@test.local", "both@test.local"));
		});

		Set<String> result = repository.findUsersWatchingCells(1, "2:3", 2, "4:5");

		assertThat(result).containsExactlyInAnyOrder(
				"old@test.local", "new@test.local", "both@test.local");
		ArgumentCaptor<byte[]> keyCaptor = ArgumentCaptor.forClass(byte[].class);
		verify(setCommands, org.mockito.Mockito.times(2)).sMembers(keyCaptor.capture());
		List<String> keys = keyCaptor.getAllValues().stream()
				.map(value -> new String(value, StandardCharsets.UTF_8))
				.toList();
		assertThat(keys).containsExactly("viewport:cell:1:2:3", "viewport:cell:2:4:5");
	}

	@Test
	@DisplayName("이전 셀과 새 셀이 같으면 한 번만 읽는다")
	@SuppressWarnings({"rawtypes", "unchecked"})
	void readsSameCellOnce() {
		RedisConnection connection = mock(RedisConnection.class);
		RedisSetCommands setCommands = mock(RedisSetCommands.class);
		when(connection.setCommands()).thenReturn(setCommands);
		when(redis.getStringSerializer()).thenReturn(RedisSerializer.string());
		when(redis.executePipelined(any(RedisCallback.class))).thenAnswer(invocation -> {
			RedisCallback callback = invocation.getArgument(0);
			callback.doInRedis(connection);
			return List.of(Set.of("viewer@test.local"));
		});

		Set<String> result = repository.findUsersWatchingCells(2, "4:5", 2, "4:5");

		assertThat(result).containsExactly("viewer@test.local");
		verify(setCommands).sMembers(any(byte[].class));
	}

	@Test
	@DisplayName("이전 셀과 새 셀이 없으면 Redis를 읽지 않는다")
	void skipsReadWithoutCells() {
		assertThat(repository.findUsersWatchingCells(null, null, null, null)).isEmpty();

		verify(redis, never()).executePipelined(any(RedisCallback.class));
	}
}
