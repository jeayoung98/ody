package com.ssafy.backend.playlist.dto;

import java.util.List;

import com.ssafy.backend.music.dto.MusicDetail;

/**
 * /playlist/detail 응답 (정본 §4.2). musics는 MusicDetail과 동일한 형태(예시 응답 기준).
 *
 * likeCnt·isLiked 는 S15P21A405-447 에서 추가했다. isLiked 는 플레이리스트 소유자가 아니라
 * <b>요청한 사람</b>이 좋아요를 눌렀는지다.
 */
public record PlaylistDetailResponse(
		long playlistId,
		String playlistName,
		int musicCnt,
		int totalDuration,
		int likeCnt,
		boolean isLiked,
		List<MusicDetail> musics) {
}
