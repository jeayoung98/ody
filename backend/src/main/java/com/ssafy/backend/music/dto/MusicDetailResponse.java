package com.ssafy.backend.music.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

/**
 * /music/detail 응답 (정본 §3.2): 상세 필드(MusicDetail) top-level + neighbors 배열.
 * {@code @JsonUnwrapped}로 MusicDetail 필드를 flat 전개한다.
 *
 * <p><b>2026-09-13 개정 (D-003).</b> {@code neighbors} 는 이제 <b>선정 규칙을 통과한 최대 10곡</b>이다 —
 * 주변 탐색(§3.5)과 같은 규칙을 쓰므로 같은 곡을 기준으로 하면 두 API 의 목록이 같다(005 FR-023, SC-006).
 * 그래서 10곡보다 적을 수 있고 {@code lowSimilarity} 가 함께 온다.
 *
 * @param lowSimilarity 마지막 이웃 거리가 원거리 임계값을 넘었다는 표시. 오류가 아니다.
 *                      운영 실측 발동률 약 9% 라 드문 경우가 아니다
 */
public record MusicDetailResponse(
		@JsonUnwrapped MusicDetail detail,
		List<NeighborTrack> neighbors,
		boolean lowSimilarity) {
}
