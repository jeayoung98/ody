package com.ssafy.backend.stats.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 주간 랭킹 응답 (S15P21A405-448).
 *
 * weekStart·weekEnd 를 같이 내려주는 이유는 "이번 주"가 언제부터인지 화면에 보여야 하고,
 * 주가 넘어가는 순간에 받은 응답이 어느 구간인지 클라이언트가 알 수 있어야 해서다.
 * 구간은 weekStart 이상 weekEnd 미만이다(끝은 포함하지 않는다).
 *
 * discovery  : 그 주에 처음 재생된 곡을 많이 찾아낸 사람 (발견왕)
 * explore    : 그 주에 재생을 많이 한 사람, 같은 곡 중복 포함 (탐험왕)
 * contribution: 그 주에 신고를 많이 한 사람 (기여도)
 */
public record WeeklyStatsResponse(
		OffsetDateTime weekStart,
		OffsetDateTime weekEnd,
		List<RankedUser> discovery,
		List<RankedUser> explore,
		List<RankedUser> contribution) {
}
