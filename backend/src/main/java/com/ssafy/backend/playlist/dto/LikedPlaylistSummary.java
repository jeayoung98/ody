package com.ssafy.backend.playlist.dto;

import java.time.OffsetDateTime;

/**
 * /playlist/liked 응답 원소 (S15P21A405-447).
 *
 * 남의 플레이리스트가 섞이는 목록이라 소유자 정보를 함께 담는다 — 화면에 만든 사람을 보여주고,
 * 눌렀을 때 그 사람 프로필로 갈 수 있어야 한다.
 * likedAt 은 좋아요를 누른 시각이고, 목록 정렬 기준도 이 값이다(최근 누른 것이 위).
 */
public record LikedPlaylistSummary(
		long playlistId,
		String playlistName,
		int musicCnt,
		int likeCnt,
		String ownerEmail,
		String ownerNickname,
		OffsetDateTime likedAt) {
}
