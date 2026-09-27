package com.ssafy.backend.follow.dto;

/**
 * 목록 종류 (api-spec §2.8의 type 파라미터).
 *
 * FOLLOWER  : 조회 대상을 팔로우하는 사람들 (나를 팔로잉하는 사람)
 * FOLLOWING : 조회 대상이 팔로우하는 사람들 (내가 팔로우하는 사람)
 */
public enum FollowType {

	FOLLOWER,
	FOLLOWING;

	/**
	 * 쿼리 파라미터(follower/following, 대소문자 무시)를 해석한다. 값이 다르면 null 을 돌려주고
	 * 서비스가 INVALID_INPUT 으로 바꾼다.
	 */
	public static FollowType from(String raw) {
		if (raw == null) {
			return null;
		}
		for (FollowType type : values()) {
			if (type.name().equalsIgnoreCase(raw)) {
				return type;
			}
		}
		return null;
	}

	public String toParam() {
		return name().toLowerCase();
	}
}
