package com.ssafy.backend.follow.dto;

import java.time.OffsetDateTime;

/**
 * 팔로워·팔로잉 목록 항목 (api-spec §2.8 UserSummary + meetingCnt).
 *
 * isFollowing 은 목록 소유자가 아니라 토큰 주체 기준이다 — 남의 팔로잉 목록을 봐도
 * "내가" 그 사람을 팔로우 중인지가 나온다.
 * meetingCnt 는 토큰 주체와 이 사람이 마주친 누적 횟수다 (S15P21A405-433).
 * isOnline 은 지금 접속해 있는지다 — 뜻은 {@code UserDetailResponse} 와 같다.
 */
public record FollowUserSummary(
		String email,
		String name,
		String nickname,
		String imageUrl,
		boolean isPublic,
		boolean isFollowing,
		OffsetDateTime lastActiveAt,
		int meetingCnt,
		boolean isOnline) {
}
