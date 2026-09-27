package com.ssafy.backend.music.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

/**
 * 주변곡 (정본 §3.2 neighbors 원소): MusicSummary 필드 + albumMbid + distance.
 * {@code @JsonUnwrapped}로 MusicSummary 필드를 flat 전개하여 정본 JSON(평탄) 형태로 직렬화한다.
 * distance는 baseline(v2.1-pca16) 거리 척도 기준, 오름차순.
 *
 * @param albumMbid 이 곡이 실린 <b>앨범</b>의 MusicBrainz ID. 없으면 {@code null} (S15P21A405-711).
 *                  주변곡 커버를 여는 열쇠다. {@code MusicSummary} 에 넣지 않은 것은 검색 결과·경로 노드까지
 *                  모양이 바뀌기 때문이다 — 커버를 그리는 목록은 여기뿐이다(S15P21A405-520)
 */
public record NeighborTrack(
		@JsonUnwrapped MusicSummary music,
		String albumMbid,
		double distance) {
}
