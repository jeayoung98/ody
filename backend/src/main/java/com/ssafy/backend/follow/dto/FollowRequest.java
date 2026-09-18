package com.ssafy.backend.follow.dto;

/**
 * 팔로우 등록·해제 요청 (api-spec §2.5·§2.6). 팔로우를 거는 쪽(follower)은 토큰 주체라 요청에 없다.
 */
public record FollowRequest(String followeeEmail) {
}
