package com.ssafy.backend.music.dto;

import java.util.List;

/**
 * /music/journey 응답 (정본 §3.3).
 *
 * <p>{@code musicCnt} 는 {@code path} 길이다. 엔진의 {@code n_stations}(중간 정거장 수)와 다르다 —
 * 출발·도착을 포함하므로 {@code n_stations + 2} 이고, start == end 인 경우만 1 이다(FR-021).
 *
 * <p>엔진이 주는 {@code far}·{@code endpoint_dist}·{@code mode}·{@code bundle} 은 여기에 넣지 않는다.
 * 정본 §3.3 응답에 대응 필드가 없고 계약 추가는 프론트 합의가 선행이다(FR-023, 2026-09-10 clarify).
 */
public record JourneyResponse(
		int musicCnt,
		int totalDuration,
		List<JourneyStop> path) {
}
