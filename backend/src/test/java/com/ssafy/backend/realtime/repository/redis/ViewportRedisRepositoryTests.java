package com.ssafy.backend.realtime.repository.redis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.geometry.ViewportRange.LayerBound;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ReplaceResult;

/** 화면 구독 스크립트에 전달하는 값과 결과를 검증한다. */
@SuppressWarnings("unchecked")
class ViewportRedisRepositoryTests {

	private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
	private final DefaultRedisScript<Long> replaceScript = mock(DefaultRedisScript.class);
	private ViewportRedisRepository repository;

	@BeforeEach
	void setUp() {
		repository = new ViewportRedisRepository(redis, replaceScript);
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
				"1:2,3:4", "viewport:cell:"))
				.thenReturn(1L);

		ReplaceResult result = repository.replaceSubscriptions(
				"user@x.com", 7L, 11L, viewport, cells);

		assertThat(result).isEqualTo(ReplaceResult.APPLIED);
		verify(redis).execute(replaceScript,
				List.of("presence:user:user@x.com", "viewport:meta:user@x.com"),
				"user@x.com", "7", "11", "3",
				"-1.0", "1.0", "-2.0", "2.0",
				"1|-3.0|3.0|-4.0|4.0;2|-5.0|5.0|-6.0|6.0",
				"1:2,3:4", "viewport:cell:");
	}

	@Test
	@DisplayName("오래된 화면 요청과 이전 접속을 구분한다")
	void distinguishesOldRequestAndStaleConnection() {
		ViewportRange viewport = new ViewportRange(1, -1.0, 1.0, -1.0, 1.0, List.of());
		List<String> keys = List.of("presence:user:user@x.com", "viewport:meta:user@x.com");
		Object[] args = {
				"user@x.com", "7", "2", "1",
				"-1.0", "1.0", "-1.0", "1.0", "", "0:0", "viewport:cell:"
		};
		when(redis.execute(replaceScript, keys, args)).thenReturn(0L, -1L);

		assertThat(repository.replaceSubscriptions(
				"user@x.com", 7L, 2L, viewport, Set.of(new Cell(0, 0))))
				.isEqualTo(ReplaceResult.OLD_REQUEST);
		assertThat(repository.replaceSubscriptions(
				"user@x.com", 7L, 2L, viewport, Set.of(new Cell(0, 0))))
				.isEqualTo(ReplaceResult.STALE_CONNECTION);
	}
}
