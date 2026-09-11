package com.ssafy.backend.playlist.dto;

import java.util.List;

/** /playlist/music/insert 응답 (정본 §4.4). 이미 담긴 곡은 skipped로 부분 성공 처리. */
public record PlaylistMusicInsertResponse(
		long playlistId,
		int insertedCnt,
		int skippedCnt,
		List<Long> skippedMusicIds,
		int musicCnt) {
}
