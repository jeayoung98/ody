package com.ssafy.backend.music.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

/**
 * 주변곡 (정본 §3.2 neighbors 원소): MusicSummary 필드 + distance.
 * {@code @JsonUnwrapped}로 MusicSummary 필드를 flat 전개하여 정본 JSON(평탄) 형태로 직렬화한다.
 * distance는 baseline(v2.1-pca16) 거리 척도 기준, 오름차순.
 */
public record NeighborTrack(
		@JsonUnwrapped MusicSummary music,
		double distance) {
}
