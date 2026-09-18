package com.ssafy.backend.music.dto;

/**
 * MusicDetail = MusicSummary + mbid/bpm/duration/playCnt/youtubeCnt (정본 §0.6).
 * /music/major 응답 원소도 이 형태(정본 §3.4).
 */
public record MusicDetail(
		Long id,
		String mbid,
		String title,
		String artist,
		Double bpm,
		Integer duration,
		String album,
		/** 발매 연도. music.release_year, 없으면 null (S15P21A405-439). */
		Integer releaseYear,
		String youtubeUrl,
		/** 유튜브 영상 식별자 11자. 확인된 영상이며 없으면 null (spec 006 FR-001). */
		String videoId,
		Location location,
		Integer playCnt,
		Integer youtubeCnt) {
}
