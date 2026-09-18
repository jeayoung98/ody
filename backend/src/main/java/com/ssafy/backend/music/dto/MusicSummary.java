package com.ssafy.backend.music.dto;

/**
 * 검색 결과 / 주변곡 / 경로 노드 (정본 §0.6).
 * MusicDetail = MusicSummary + mbid/bpm/duration/playCnt/youtubeCnt.
 *
 * @param youtubeUrl 유튜브 <b>검색</b> URL. 그 곡이라는 보장은 없다
 * @param videoId    유튜브 영상 식별자 11자. 확인된 영상이며, 없으면 {@code null} (S15P21A405-57, spec 006 FR-001).
 *                   적재 전까지 전 곡 {@code null} 이고 클라이언트는 {@code youtubeUrl} 로 폴백한다(FR-003)
 */
public record MusicSummary(
		Long id,
		String title,
		String artist,
		String album,
		String youtubeUrl,
		String videoId,
		Location location) {
}
