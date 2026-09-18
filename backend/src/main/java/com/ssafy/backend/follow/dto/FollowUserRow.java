package com.ssafy.backend.follow.dto;

import java.time.OffsetDateTime;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

/**
 * 팔로워·팔로잉 목록 row (MyBatis 결과 매핑 전용, mutable).
 *
 * isPublic 은 Lombok 의 boolean setter 규칙(setPublic)이 MyBatis 가 기대하는 프로퍼티명과 어긋나
 * UserProfileRow 와 같은 이유로 setter 만 수동 선언한다.
 */
@Getter
@Setter
public class FollowUserRow {

	private String email;
	private String name;
	private String nickname;
	private String imageUrl;

	@Setter(AccessLevel.NONE)
	private boolean isPublic;

	private OffsetDateTime lastActiveAt;
	private int meetingCnt;
	private boolean following;

	public void setIsPublic(boolean isPublic) {
		this.isPublic = isPublic;
	}
}
