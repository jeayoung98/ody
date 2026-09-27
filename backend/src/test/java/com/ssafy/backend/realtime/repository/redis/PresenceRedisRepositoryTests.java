package com.ssafy.backend.realtime.repository.redis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.serializer.RedisSerializer;

import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.LeaveResult;

/** 사용자 이탈 스크립트에 주변사람 정리 값을 전달하는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class PresenceRedisRepositoryTests {

	@Mock StringRedisTemplate redis;
	@Mock DefaultRedisScript<List> joinScript;
	@Mock DefaultRedisScript<List> playScript;
	@Mock DefaultRedisScript<List> leaveScript;
	@Mock DefaultRedisScript<Long> recountScript;
	@Mock DefaultRedisScript<List> ridePlaceScript;

	private PresenceRedisRepository repository;

	@BeforeEach
	void setUp() {
		repository = new PresenceRedisRepository(
				redis, joinScript, playScript, leaveScript, recountScript, ridePlaceScript);
	}

	@Test
	@DisplayName("여러 셀의 재생 중인 곡을 한 번에 읽는다")
	@SuppressWarnings({"rawtypes", "unchecked"})
	void readsActiveMusicByCellAtOnce() {
		List<Cell> cells = List.of(new Cell(1, 2), new Cell(3, 4));
		when(redis.getStringSerializer()).thenReturn(RedisSerializer.string());
		when(redis.executePipelined(any(RedisCallback.class)))
				.thenReturn((List) List.of(Set.of("10", "20"), Set.of()));

		Map<Cell, Set<Long>> result = repository.findActiveMusicIdsByCell(2, cells);

		assertThat(result.get(cells.get(0))).containsExactlyInAnyOrder(10L, 20L);
		assertThat(result.get(cells.get(1))).isEmpty();
		verify(redis).executePipelined(any(RedisCallback.class));
	}

	@Test
	@DisplayName("여러 곡의 현재 레이어 청취자를 한 번에 읽는다")
	@SuppressWarnings({"rawtypes", "unchecked"})
	void readsListenersByMusicAtOnce() {
		when(redis.getStringSerializer()).thenReturn(RedisSerializer.string());
		when(redis.executePipelined(any(RedisCallback.class)))
				.thenReturn((List) List.of(Set.of("a@test.local"), Set.of("b@test.local")));

		Map<Long, Set<String>> result = repository.findListenersByMusic(3, List.of(10L, 20L));

		assertThat(result.get(10L)).containsExactly("a@test.local");
		assertThat(result.get(20L)).containsExactly("b@test.local");
		verify(redis).executePipelined(any(RedisCallback.class));
	}

	@Test
	@DisplayName("여러 곡의 현재 레이어 청취자 수를 한 번에 읽는다")
	@SuppressWarnings({"rawtypes", "unchecked"})
	void readsListenerCountsByMusicAtOnce() {
		when(redis.getStringSerializer()).thenReturn(RedisSerializer.string());
		when(redis.executePipelined(any(RedisCallback.class)))
				.thenReturn((List) List.of(3L, 0L));

		Map<Long, Integer> result = repository.findListenerCountsByMusic(3, List.of(10L, 20L));

		assertThat(result).containsEntry(10L, 3).containsEntry(20L, 0);
		verify(redis).executePipelined(any(RedisCallback.class));
	}

	@Test
	@DisplayName("입장은 현재 소켓의 접속 번호를 Redis에 함께 전달한다")
	void joinPassesExpectedEpoch() {
		when(redis.execute(joinScript, List.of("presence:user:user@x.com"),
				"user@x.com", "7", "", "", "",
				"20", "2", "3:4", "0.3", "0.4", "3", "4",
				"listeners:", "layer-listeners:", "active-song:cell:",
				"active-song:cells:", "cell:usercount:"))
				.thenReturn(List.of("OK"));

		assertThat(repository.join("user@x.com", 7L, null, null, null, null,
				20L, 2, 0.3, 0.4, 3, 4)).isTrue();

		verify(redis).execute(joinScript, List.of("presence:user:user@x.com"),
				"user@x.com", "7", "", "", "",
				"20", "2", "3:4", "0.3", "0.4", "3", "4",
				"listeners:", "layer-listeners:", "active-song:cell:",
				"active-song:cells:", "cell:usercount:");
	}

	@Test
	@DisplayName("직접 종료는 접속 버전과 실시간 구독 키를 전달한다")
	void leavePassesEpochAndRealtimeKeys() {
		List<String> removed = List.of("20", "2", "3", "4", "7");
		when(redis.execute(leaveScript,
				List.of("presence:user:user@x.com", "presence:expiry",
						"nearby:meta:user@x.com", "viewport:meta:user@x.com"),
				"user@x.com", "7", "",
				"listeners:", "layer-listeners:", "active-song:cell:", "active-song:cells:",
				"cell:usercount:", "nearby:layer-subscribers:", "viewport:cell:", "viewport:clustered:"))
				.thenReturn(removed);

		assertThat(repository.applyLeave("user@x.com", 7L))
				.isEqualTo(new LeaveResult(true, removed));
		verify(redis).execute(leaveScript,
				List.of("presence:user:user@x.com", "presence:expiry",
						"nearby:meta:user@x.com", "viewport:meta:user@x.com"),
				"user@x.com", "7", "",
				"listeners:", "layer-listeners:", "active-song:cell:", "active-song:cells:",
				"cell:usercount:", "nearby:layer-subscribers:", "viewport:cell:", "viewport:clustered:");
	}

	@Test
	@DisplayName("만료 종료는 확인 시각과 실시간 구독 키를 전달한다")
	void expiredLeavePassesTimeAndRealtimeKeys() {
		List<String> removed = List.of("20", "2", "3", "4", "7");
		when(redis.execute(leaveScript,
				List.of("presence:user:user@x.com", "presence:expiry",
						"nearby:meta:user@x.com", "viewport:meta:user@x.com"),
				"user@x.com", "", "1000",
				"listeners:", "layer-listeners:", "active-song:cell:", "active-song:cells:",
				"cell:usercount:", "nearby:layer-subscribers:", "viewport:cell:", "viewport:clustered:"))
				.thenReturn(removed);

		assertThat(repository.applyLeaveExpired("user@x.com", 1000L))
				.isEqualTo(new LeaveResult(true, removed));
		verify(redis).execute(leaveScript,
				List.of("presence:user:user@x.com", "presence:expiry",
						"nearby:meta:user@x.com", "viewport:meta:user@x.com"),
				"user@x.com", "", "1000",
				"listeners:", "layer-listeners:", "active-song:cell:", "active-song:cells:",
				"cell:usercount:", "nearby:layer-subscribers:", "viewport:cell:", "viewport:clustered:");
	}
}
