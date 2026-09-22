package com.ssafy.backend.artwork.dto;

import java.time.OffsetDateTime;

/**
 * 회차 응답. {@code themePrompt} 는 담지 않는다 — 채점 기준 문장을 그대로 내려주면
 * 그것에 맞춰 곡을 고르는 것이 최적 전략이 된다.
 */
public record ArtworkRound(long roundId, String theme, OffsetDateTime startsAt, OffsetDateTime endsAt) {
}
