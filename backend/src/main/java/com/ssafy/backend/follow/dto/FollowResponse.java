package com.ssafy.backend.follow.dto;

/**
 * 팔로우 등록·해제 응답 (api-spec §2.5·§2.6).
 *
 * followeeFollowerCnt 는 변경 후 상대의 팔로워 수다 — 프론트가 다시 조회하지 않고 화면 숫자를 갱신한다.
 */
public record FollowResponse(
		String followerEmail,
		String followeeEmail,
		boolean isFollowing,
		int followeeFollowerCnt) {
}
