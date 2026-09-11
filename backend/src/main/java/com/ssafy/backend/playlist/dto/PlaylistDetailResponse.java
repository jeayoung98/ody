package com.ssafy.backend.playlist.dto;

import java.util.List;

import com.ssafy.backend.music.dto.MusicDetail;

/** /playlist/detail 응답 (정본 §4.2). musics는 MusicDetail과 동일한 형태(예시 응답 기준). */
public record PlaylistDetailResponse(
		long playlistId,
		String playlistName,
		int musicCnt,
		int totalDuration,
		List<MusicDetail> musics) {
}
