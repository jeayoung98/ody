package com.ssafy.backend.music.dto;

import java.util.List;

/**
 * 검색 결과 / 주변곡 / 경로 노드 (정본 §0.6).
 * MusicDetail = MusicSummary + mbid/bpm/duration/playCnt/youtubeCnt.
 * genres는 원문상 list|string|null 다형이나, 현재 코드(MusicDetail)와 동일하게 List<String>으로 둔다.
 * (다형 표현 확정은 B-Field 대기.)
 */
public record MusicSummary(
		Long id,
		String title,
		String artist,
		String album,
		List<String> genres,
		String youtubeUrl,
		Location location) {
}
