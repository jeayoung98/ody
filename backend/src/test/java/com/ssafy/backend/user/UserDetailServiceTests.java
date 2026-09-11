package com.ssafy.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.user.dto.UserDetailResponse;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.mapper.UserMapper;
import com.ssafy.backend.user.service.UserService;

/**
 * 사용자 상세 서비스 유닛 (mock mapper). 조립·본인/타인 분기·404/403 전환을 검증한다.
 * followerCnt/followingCnt/isFollowing은 팔로우 MVP 전까지 0/0/false 고정(계약).
 */
class UserDetailServiceTests {

	private static UserProfileRow row(boolean isPublic) {
		UserProfileRow row = new UserProfileRow();
		row.setEmail("you@gmail.com");
		row.setName("김철수");
		row.setNickname("철수형");
		row.setImageUrl("https://cdn.example.com/profile/abc.png");
		row.setIsPublic(isPublic);
		row.setTutorialCompleted(true);
		row.setLastActiveAt(OffsetDateTime.parse("2026-09-07T13:41:02+09:00"));
		row.setCreatedAt(OffsetDateTime.parse("2026-08-21T09:12:44+09:00"));
		return row;
	}

	@Test
	void getDetail_otherPublicUser_returnsDetailWithIsMeFalse() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(true));
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class));

		UserDetailResponse result = service.getDetail("you@gmail.com", "me@gmail.com");

		assertThat(result.email()).isEqualTo("you@gmail.com");
		assertThat(result.tutorialCompleted()).isTrue();
		assertThat(result.isPublic()).isTrue();
		assertThat(result.isMe()).isFalse();
		assertThat(result.followerCnt()).isZero();
		assertThat(result.followingCnt()).isZero();
		assertThat(result.isFollowing()).isFalse();
	}

	@Test
	void getDetail_selfPrivateUser_returnsDetailWithIsMeTrue() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(false));
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class));

		UserDetailResponse result = service.getDetail("you@gmail.com", "you@gmail.com");

		assertThat(result.isMe()).isTrue();
		assertThat(result.isPublic()).isFalse();
	}

	@Test
	void getDetail_otherPrivateUser_throwsUserPrivate() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(false));
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class));

		assertThatThrownBy(() -> service.getDetail("you@gmail.com", "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_PRIVATE);
	}

	@Test
	void getDetail_notFound_throwsUserNotFound() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("nobody@gmail.com")).thenReturn(null);
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class));

		assertThatThrownBy(() -> service.getDetail("nobody@gmail.com", "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_NOT_FOUND);
	}
}
