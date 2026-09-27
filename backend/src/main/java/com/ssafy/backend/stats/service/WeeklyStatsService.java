package com.ssafy.backend.stats.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.ssafy.backend.stats.dto.RankedUser;
import com.ssafy.backend.stats.dto.RankedUserRow;
import com.ssafy.backend.stats.dto.WeeklyStatsResponse;
import com.ssafy.backend.stats.mapper.WeeklyStatsMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 주간 랭킹 (S15P21A405-448). 이번 주는 한국 시간 월요일 00:00 시작이다(WeekRange).
 *
 * 세 랭킹을 한 번에 돌려주므로 쿼리도 세 번 나간다. 화면이 세 탭을 한 번에 그리는 구조라
 * 요청을 나누는 것보다 왕복이 적다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeeklyStatsService {

	/** 각 랭킹에 담는 인원 (top 10). */
	public static final int TOP_N = 10;

	private final WeeklyStatsMapper weeklyStatsMapper;
	private final Clock clock;

	public WeeklyStatsResponse weekly() {
		WeekRange week = WeekRange.currentWeek(clock);

		List<RankedUser> discovery = rank(weeklyStatsMapper.findTopDiscoverers(week.start(), week.end(), TOP_N));
		List<RankedUser> explore = rank(weeklyStatsMapper.findTopExplorers(week.start(), week.end(), TOP_N));
		List<RankedUser> contribution = rank(weeklyStatsMapper.findTopContributors(week.start(), week.end(), TOP_N));

		log.info("[Stats] 주간 랭킹 조회 완료 weekStart={} discovery={} explore={} contribution={}",
				week.start(), discovery.size(), explore.size(), contribution.size());
		return new WeeklyStatsResponse(week.start(), week.end(), discovery, explore, contribution);
	}

	/**
	 * 순위를 매긴다. 정렬은 SQL 이 이미 끝냈고 여기서는 1부터 번호만 붙인다 —
	 * 동점자도 서로 다른 번호를 받는다(공동 순위 없음).
	 */
	private static List<RankedUser> rank(List<RankedUserRow> rows) {
		List<RankedUser> ranked = new ArrayList<>(rows.size());
		for (int i = 0; i < rows.size(); i++) {
			RankedUserRow row = rows.get(i);
			ranked.add(new RankedUser(
					i + 1, row.getEmail(), row.getNickname(), row.getImageUrl(), row.getCount()));
		}
		return List.copyOf(ranked);
	}
}
