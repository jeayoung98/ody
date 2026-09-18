package com.ssafy.backend.stats.service;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;

/**
 * 주간 집계 구간 (S15P21A405-448).
 *
 * 한국 시간 월요일 00:00 부터 다음 월요일 00:00 직전까지다. 사용자가 말하는 "이번 주"와 맞추기 위해
 * 서버·DB 시간대와 무관하게 Asia/Seoul 로 계산한다 — 배포 환경이 UTC 면 월요일 시작이 한국 시간
 * 일요일 오전 9시가 되어 하루가 밀린다.
 *
 * 끝은 포함하지 않는다(start <= t < end). 23:59:59 를 끝으로 잡으면 그 사이 1초가 어느 주에도
 * 속하지 않는다.
 */
public record WeekRange(OffsetDateTime start, OffsetDateTime end) {

	public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

	/** 주어진 시계 기준으로 이번 주 구간. 테스트는 고정 Clock 을 넘긴다. */
	public static WeekRange currentWeek(Clock clock) {
		LocalDate today = LocalDate.now(clock.withZone(ZONE));
		LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

		OffsetDateTime start = monday.atStartOfDay(ZONE).toOffsetDateTime();
		OffsetDateTime end = monday.plusWeeks(1).atStartOfDay(ZONE).toOffsetDateTime();
		return new WeekRange(start, end);
	}
}
