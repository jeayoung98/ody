package com.ssafy.backend.music.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

/**
 * 경로 정거장 (정본 §3.3 path 원소): step + MusicDetail 필드.
 * {@code @JsonUnwrapped}로 MusicDetail 필드를 flat 전개해 정본 JSON(평탄) 형태로 직렬화한다(003 NeighborTrack 선례).
 *
 * <p>step 은 최종 목록 기준 0부터 1씩 증가하는 연속값이다. 엔진이 주는 {@code rank}를 쓰지 않는다 —
 * 엔진 rank 는 중간 정거장만 1부터 세는 값이라 출발·도착을 붙인 최종 목록과 어긋난다(FR-005).
 */
public record JourneyStop(
		int step,
		@JsonUnwrapped MusicDetail music) {
}
