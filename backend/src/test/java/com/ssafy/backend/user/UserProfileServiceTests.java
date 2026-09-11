package com.ssafy.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.dto.UserProfileUpdateRequest;
import com.ssafy.backend.user.dto.UserProfileUpdateResponse;
import com.ssafy.backend.user.mapper.UserMapper;
import com.ssafy.backend.user.service.UserService;

/**
 * 프로필(닉네임/이미지) 부분 수정 유닛 (S15P21A405-216). 구글 신규가입으로 nickname이 비어(NULL) 들어간
 * 사용자를 채우는 경로. tutorial-completed, is_public은 이 서비스 메서드 범위 밖이다.
 */
class UserProfileServiceTests {

	private final UserMapper userMapper = mock(UserMapper.class);
	private final AuthMapper authMapper = mock(AuthMapper.class);
	private final UserService userService = new UserService(userMapper, authMapper);

	private static UserProfileRow row(String nickname, String imageUrl) {
		UserProfileRow row = new UserProfileRow();
		row.setEmail("me@gmail.com");
		row.setNickname(nickname);
		row.setImageUrl(imageUrl);
		return row;
	}

	@Test
	void updateProfile_newNickname_updatesAndReturnsResult() {
		when(userMapper.findProfileByEmail("me@gmail.com"))
				.thenReturn(row(null, null))
				.thenReturn(row("새닉네임", null));
		when(authMapper.existsByNickname("새닉네임")).thenReturn(false);

		UserProfileUpdateResponse result =
				userService.updateProfile("me@gmail.com", new UserProfileUpdateRequest("새닉네임", null));

		assertThat(result.nickname()).isEqualTo("새닉네임");
		verify(userMapper).updateProfile("me@gmail.com", "새닉네임", null);
	}

	@Test
	void updateProfile_sameNicknameAsCurrent_doesNotTreatAsDuplicate() {
		when(userMapper.findProfileByEmail("me@gmail.com")).thenReturn(row("기존닉네임", null));

		userService.updateProfile("me@gmail.com", new UserProfileUpdateRequest("기존닉네임", null));

		verify(authMapper, never()).existsByNickname(eq("기존닉네임"));
		verify(userMapper).updateProfile("me@gmail.com", "기존닉네임", null);
	}

	@Test
	void updateProfile_duplicateNickname_throwsNicknameAlreadyExists() {
		when(userMapper.findProfileByEmail("me@gmail.com")).thenReturn(row("기존닉네임", null));
		when(authMapper.existsByNickname("중복닉네임")).thenReturn(true);

		assertThatThrownBy(() -> userService.updateProfile(
				"me@gmail.com", new UserProfileUpdateRequest("중복닉네임", null)))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.NICKNAME_ALREADY_EXISTS);
	}

	@Test
	void updateProfile_invalidNicknameLength_throwsInvalidNicknameLength() {
		assertThatThrownBy(() -> userService.updateProfile(
				"me@gmail.com", new UserProfileUpdateRequest("a", null)))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.INVALID_NICKNAME_LENGTH);
	}

	@Test
	void updateProfile_bothFieldsNull_throwsInvalidInput() {
		assertThatThrownBy(() -> userService.updateProfile(
				"me@gmail.com", new UserProfileUpdateRequest(null, null)))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);
	}

	@Test
	void updateProfile_onlyImageUrl_updatesImageOnlyWithoutNicknameLookup() {
		when(userMapper.findProfileByEmail("me@gmail.com"))
				.thenReturn(row("기존닉네임", "https://cdn.example.com/new.png"));

		UserProfileUpdateResponse result = userService.updateProfile(
				"me@gmail.com", new UserProfileUpdateRequest(null, "https://cdn.example.com/new.png"));

		assertThat(result.imageUrl()).isEqualTo("https://cdn.example.com/new.png");
		verify(userMapper).updateProfile("me@gmail.com", null, "https://cdn.example.com/new.png");
	}
}
