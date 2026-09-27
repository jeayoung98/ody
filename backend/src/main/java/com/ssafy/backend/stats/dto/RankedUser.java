package com.ssafy.backend.stats.dto;

/**
 * 주간 랭킹 한 칸 (S15P21A405-448).
 *
 * rank 는 1부터다. 동점자도 서로 다른 순위를 받는다 — 화면이 top 10 목록이라 공동 순위를 표현하지
 * 않고, 같은 점수면 email 순으로 고정한다(조회할 때마다 순서가 바뀌지 않게).
 * count 의 의미는 랭킹 종류마다 다르다: 발견한 곡 수, 재생 횟수, 신고 건수.
 */
public record RankedUser(
		int rank,
		String email,
		String nickname,
		String imageUrl,
		int count) {
}
