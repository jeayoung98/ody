package com.ssafy.backend.user.dto;

import java.time.OffsetDateTime;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

/**
 * "user" 테이블 상세 조회 row (MyBatis 결과 매핑 전용, mutable).
 *
 * isPublic 필드는 Lombok의 boolean setter 명명 규칙(setPublic)이 MyBatis가 기대하는
 * 프로퍼티명(isPublic, 컬럼 is_public의 camelCase)과 어긋나 자동 매핑이 조용히 실패하므로,
 * setter만 수동으로 이름을 맞춰 선언한다.
 */
@Getter
@Setter
public class UserProfileRow {

	private String email;
	private String name;
	private String nickname;
	private String imageUrl;

	@Setter(AccessLevel.NONE)
	private boolean isPublic;

	private boolean tutorialCompleted;
	private OffsetDateTime lastActiveAt;
	private OffsetDateTime createdAt;

	public void setIsPublic(boolean isPublic) {
		this.isPublic = isPublic;
	}
}
