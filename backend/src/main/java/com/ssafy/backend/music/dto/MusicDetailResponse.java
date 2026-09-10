package com.ssafy.backend.music.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

/**
 * /music/detail 응답 (정본 §3.2): 상세 필드(MusicDetail) top-level + neighbors 배열.
 * {@code @JsonUnwrapped}로 MusicDetail 필드를 flat 전개한다.
 */
public record MusicDetailResponse(
		@JsonUnwrapped MusicDetail detail,
		List<NeighborTrack> neighbors) {
}
