package com.ssafy.backend.artwork.dto;

import java.time.OffsetDateTime;

/**
 * 회차 응답. {@code themePrompt} 는 담지 않는다 — 채점 기준 문장을 그대로 내려주면
 * 그것에 맞춰 곡을 고르는 것이 최적 전략이 된다.
 *
 * @param voteLimit   회차당 남의 작품에 줄 수 있는 좋아요 수 (S15P21A405-616)
 * @param myVotesLeft 로그인 사용자의 남은 좋아요. 비로그인이면 null
 */
public record ArtworkRound(
		long roundId, String theme, OffsetDateTime startsAt, OffsetDateTime endsAt,
		int voteLimit, Integer myVotesLeft) {
}
