package com.ssafy.backend.user.dto;

import java.time.OffsetDateTime;

/**
 * /user/detail 응답 (정본 §2.1, tutorialCompleted 필드로 lastMusic 대체).
 * 본인 조회 시 isMe=true. followerCnt/followingCnt/isFollowing은 팔로우 MVP(E1) 확정 전까지
 * 0/false 고정 placeholder (S15P21A405-70 이슈 설명 참고).
 */
public record UserDetailResponse(
		String email,
		String name,
		String nickname,
		boolean isPublic,
		boolean tutorialCompleted,
		OffsetDateTime lastActiveAt,
		OffsetDateTime createdAt,
		String imageUrl,
		int followerCnt,
		int followingCnt,
		boolean isFollowing,
		boolean isMe) {
}
