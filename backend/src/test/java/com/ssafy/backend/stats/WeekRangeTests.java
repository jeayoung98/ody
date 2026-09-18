package com.ssafy.backend.stats;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.stats.service.WeekRange;

/**
 * 주 경계 계산 (S15P21A405-448). 기준은 한국 시간 월요일 00:00 이고, 서버 시간대와 무관해야 한다.
 */
class WeekRangeTests {

	/** 2026-09-18 금요일 10:00 KST. */
	private static Clock fridayKst() {
		return Clock.fixed(Instant.parse("2026-09-18T01:00:00Z"), ZoneId.of("Asia/Seoul"));
	}

	@Test
	void currentWeek_midWeek_startsOnMondayMidnightKst() {
		WeekRange week = WeekRange.currentWeek(fridayKst());

		assertThat(week.start().toString()).startsWith("2026-09-14T00:00+09:00");
		assertThat(week.end().toString()).startsWith("2026-09-21T00:00+09:00");
	}

	@Test
	void currentWeek_onMonday_startsThatSameDay() {
		// 2026-09-14 월요일 00:30 KST
		Clock monday = Clock.fixed(Instant.parse("2026-09-13T15:30:00Z"), ZoneId.of("Asia/Seoul"));

		WeekRange week = WeekRange.currentWeek(monday);

		assertThat(week.start().toString()).startsWith("2026-09-14T00:00+09:00");
	}

	@Test
	void currentWeek_sundayLateNight_stillBelongsToPreviousMonday() {
		// 2026-09-20 일요일 23:30 KST — 다음 주가 아니라 아직 14일 시작 주다.
		Clock sunday = Clock.fixed(Instant.parse("2026-09-20T14:30:00Z"), ZoneId.of("Asia/Seoul"));

		WeekRange week = WeekRange.currentWeek(sunday);

		assertThat(week.start().toString()).startsWith("2026-09-14T00:00+09:00");
		assertThat(week.end().toString()).startsWith("2026-09-21T00:00+09:00");
	}

	@Test
	void currentWeek_serverInUtc_usesKoreanWeekBoundaryAnyway() {
		// 2026-09-14 월요일 03:00 KST = 2026-09-13 18:00 UTC.
		// 서버가 UTC 여도 한국 기준으로는 이미 새 주가 시작됐다.
		Clock utcServer = Clock.fixed(Instant.parse("2026-09-13T18:00:00Z"), ZoneOffset.UTC);

		WeekRange week = WeekRange.currentWeek(utcServer);

		assertThat(week.start().toString()).startsWith("2026-09-14T00:00+09:00");
	}

	@Test
	void currentWeek_endIsExclusiveNextMonday() {
		WeekRange week = WeekRange.currentWeek(fridayKst());

		assertThat(week.end()).isEqualTo(week.start().plusWeeks(1));
		assertThat(week.start()).isBefore(week.end());
	}
}
