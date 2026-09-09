package com.ssafy.backend.music.dto;

import java.util.List;

/**
 * MusicDetail = MusicSummary + mbid/bpm/duration/playCnt/youtubeCnt (정본 §0.6·§3.2).
 */
public record MusicDetail(
		Long id,
		String mbid,
		String title,
		String artist,
		Double bpm,
		Integer duration,
		String album,
		List<String> genres,
		String youtubeUrl,
		Location location,
		Integer playCnt,
		Integer youtubeCnt) {
}
