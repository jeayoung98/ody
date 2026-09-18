package com.ssafy.backend.stats.mapper;

import java.time.OffsetDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.stats.dto.RankedUserRow;

/**
 * 주간 랭킹 집계 (S15P21A405-448). 세 쿼리 모두 start 이상 end 미만 구간을 본다.
 */
public interface WeeklyStatsMapper {

	/** 발견왕 — 그 주에 처음 재생된 곡을 찾아낸 수. */
	List<RankedUserRow> findTopDiscoverers(@Param("start") OffsetDateTime start,
			@Param("end") OffsetDateTime end, @Param("limit") int limit);

	/** 탐험왕 — 그 주의 재생 기록 수. 같은 곡을 여러 번 들으면 여러 번 센다. */
	List<RankedUserRow> findTopExplorers(@Param("start") OffsetDateTime start,
			@Param("end") OffsetDateTime end, @Param("limit") int limit);

	/** 기여도 — 그 주의 신고 건수. 비로그인 신고(user_email IS NULL)는 제외한다. */
	List<RankedUserRow> findTopContributors(@Param("start") OffsetDateTime start,
			@Param("end") OffsetDateTime end, @Param("limit") int limit);
}
