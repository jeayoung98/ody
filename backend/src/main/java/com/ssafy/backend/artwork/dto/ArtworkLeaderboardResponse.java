package com.ssafy.backend.artwork.dto;

import java.util.List;

/**
 * 회차 리더보드 응답.
 *
 * @param items 점수 내림차순. 동점이면 좋아요 수, 그래도 같으면 먼저 제출한 순
 */
public record ArtworkLeaderboardResponse(
		ArtworkRound round, List<ArtworkSummary> items, int page, int size, int totalCnt) {
}
