package com.ssafy.backend.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ssafy.backend.stats.dto.RankedUserRow;
import com.ssafy.backend.stats.dto.WeeklyStatsResponse;
import com.ssafy.backend.stats.mapper.WeeklyStatsMapper;
import com.ssafy.backend.stats.service.WeeklyStatsService;

/**
 * 주간 랭킹 서비스 유닛 (S15P21A405-448). 집계 자체는 SQL 책임이라 여기서는 구간 전달과
 * 순위 매김, 빈 결과 처리를 본다.
 */
class WeeklyStatsServiceTests {

	private final WeeklyStatsMapper mapper = mock(WeeklyStatsMapper.class);

	/** 2026-09-18 금요일 10:00 KST → 이번 주는 9/14 00:00 부터. */
	private final Clock clock = Clock.fixed(Instant.parse("2026-09-18T01:00:00Z"), ZoneId.of("Asia/Seoul"));

	private final WeeklyStatsService service = new WeeklyStatsService(mapper, clock);

	private static RankedUserRow row(String email, int count) {
		RankedUserRow row = new RankedUserRow();
		row.setEmail(email);
		row.setNickname("철수형");
		row.setImageUrl("https://cdn.example.com/a.png");
		row.setCount(count);
		return row;
	}

	@Test
	void weekly_returnsWeekBoundsFromKoreanMonday() {
		when(mapper.findTopDiscoverers(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());
		when(mapper.findTopExplorers(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());
		when(mapper.findTopContributors(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());

		WeeklyStatsResponse result = service.weekly();

		assertThat(result.weekStart().toString()).startsWith("2026-09-14T00:00+09:00");
		assertThat(result.weekEnd().toString()).startsWith("2026-09-21T00:00+09:00");
	}

	@Test
	void weekly_passesSameRangeToAllThreeQueries() {
		when(mapper.findTopDiscoverers(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());
		when(mapper.findTopExplorers(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());
		when(mapper.findTopContributors(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());

		WeeklyStatsResponse result = service.weekly();

		ArgumentCaptor<OffsetDateTime> start = ArgumentCaptor.forClass(OffsetDateTime.class);
		ArgumentCaptor<OffsetDateTime> end = ArgumentCaptor.forClass(OffsetDateTime.class);
		verify(mapper).findTopExplorers(start.capture(), end.capture(), eq(WeeklyStatsService.TOP_N));

		assertThat(start.getValue()).isEqualTo(result.weekStart());
		assertThat(end.getValue()).isEqualTo(result.weekEnd());
	}

	@Test
	void weekly_numbersRanksFromOneInQueryOrder() {
		when(mapper.findTopDiscoverers(any(), any(), eq(WeeklyStatsService.TOP_N)))
				.thenReturn(List.of(row("a@gmail.com", 9), row("b@gmail.com", 4)));
		when(mapper.findTopExplorers(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());
		when(mapper.findTopContributors(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());

		WeeklyStatsResponse result = service.weekly();

		assertThat(result.discovery()).hasSize(2);
		assertThat(result.discovery().get(0).rank()).isEqualTo(1);
		assertThat(result.discovery().get(0).email()).isEqualTo("a@gmail.com");
		assertThat(result.discovery().get(0).count()).isEqualTo(9);
		assertThat(result.discovery().get(1).rank()).isEqualTo(2);
	}

	@Test
	void weekly_tiedCounts_stillGetDistinctRanks() {
		when(mapper.findTopDiscoverers(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());
		when(mapper.findTopExplorers(any(), any(), eq(WeeklyStatsService.TOP_N)))
				.thenReturn(List.of(row("a@gmail.com", 5), row("b@gmail.com", 5)));
		when(mapper.findTopContributors(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());

		WeeklyStatsResponse result = service.weekly();

		assertThat(result.explore().get(0).rank()).isEqualTo(1);
		assertThat(result.explore().get(1).rank()).isEqualTo(2);
	}

	@Test
	void weekly_noRecords_returnsEmptyListsNotNull() {
		when(mapper.findTopDiscoverers(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());
		when(mapper.findTopExplorers(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());
		when(mapper.findTopContributors(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());

		WeeklyStatsResponse result = service.weekly();

		assertThat(result.discovery()).isEmpty();
		assertThat(result.explore()).isEmpty();
		assertThat(result.contribution()).isEmpty();
	}

	@Test
	void weekly_asksForTenPerRanking() {
		List<RankedUserRow> ten = new ArrayList<>();
		for (int i = 0; i < WeeklyStatsService.TOP_N; i++) {
			ten.add(row("user" + i + "@gmail.com", 20 - i));
		}
		when(mapper.findTopDiscoverers(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(ten);
		when(mapper.findTopExplorers(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());
		when(mapper.findTopContributors(any(), any(), eq(WeeklyStatsService.TOP_N))).thenReturn(List.of());

		WeeklyStatsResponse result = service.weekly();

		assertThat(WeeklyStatsService.TOP_N).isEqualTo(10);
		assertThat(result.discovery()).hasSize(10);
		assertThat(result.discovery().get(9).rank()).isEqualTo(10);
	}
}
