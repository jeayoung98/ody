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
import com.ssafy.backend.presence.OfflineOnlyStatusService;
import com.ssafy.backend.follow.service.FollowService;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.user.dto.NicknameUpdateRequest;
import com.ssafy.backend.user.dto.NicknameUpdateResponse;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.mapper.UserMapper;
import com.ssafy.backend.user.service.UserService;

/**
 * 닉네임 수정 유닛 (S15P21A405-426, 이전 UserProfileServiceTests 에서 이미지 부분이 빠진 것).
 * 프로필 이미지는 ProfileImageServiceTests 가 다룬다.
 */
class UserNicknameServiceTests {

	private final UserMapper userMapper = mock(UserMapper.class);
	private final AuthMapper authMapper = mock(AuthMapper.class);
	private final UserService userService = new UserService(userMapper, authMapper, mock(FollowService.class), new OfflineOnlyStatusService(),
			mock(MusicDetailReader.class));

	private static UserProfileRow row(String nickname) {
		UserProfileRow row = new UserProfileRow();
		row.setEmail("me@gmail.com");
		row.setNickname(nickname);
		return row;
	}

	@Test
	void updateNickname_newNickname_updatesAndReturnsResult() {
		when(userMapper.findProfileByEmail("me@gmail.com")).thenReturn(row(null));
		when(authMapper.existsByNickname("새닉네임")).thenReturn(false);

		NicknameUpdateResponse result =
				userService.updateNickname("me@gmail.com", new NicknameUpdateRequest("새닉네임"));

		assertThat(result.nickname()).isEqualTo("새닉네임");
		verify(userMapper).updateNickname("me@gmail.com", "새닉네임");
	}

	@Test
	void updateNickname_sameAsCurrent_doesNotTreatAsDuplicate() {
		when(userMapper.findProfileByEmail("me@gmail.com")).thenReturn(row("기존닉네임"));

		userService.updateNickname("me@gmail.com", new NicknameUpdateRequest("기존닉네임"));

		verify(authMapper, never()).existsByNickname(eq("기존닉네임"));
		verify(userMapper).updateNickname("me@gmail.com", "기존닉네임");
	}

	@Test
	void updateNickname_duplicate_throwsNicknameAlreadyExists() {
		when(userMapper.findProfileByEmail("me@gmail.com")).thenReturn(row("기존닉네임"));
		when(authMapper.existsByNickname("중복닉네임")).thenReturn(true);

		assertThatThrownBy(() -> userService.updateNickname(
				"me@gmail.com", new NicknameUpdateRequest("중복닉네임")))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.NICKNAME_ALREADY_EXISTS);

		verify(userMapper, never()).updateNickname(eq("me@gmail.com"), eq("중복닉네임"));
	}

	@Test
	void updateNickname_invalidLength_throwsInvalidNicknameLength() {
		assertThatThrownBy(() -> userService.updateNickname(
				"me@gmail.com", new NicknameUpdateRequest("a")))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.INVALID_NICKNAME_LENGTH);
	}

	@Test
	void updateNickname_blank_throwsInvalidInput() {
		assertThatThrownBy(() -> userService.updateNickname(
				"me@gmail.com", new NicknameUpdateRequest("   ")))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);
	}

	@Test
	void updateNickname_null_throwsInvalidInput() {
		assertThatThrownBy(() -> userService.updateNickname(
				"me@gmail.com", new NicknameUpdateRequest(null)))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);
	}

	@Test
	void updateNickname_unknownUser_throwsUserNotFound() {
		when(userMapper.findProfileByEmail("ghost@gmail.com")).thenReturn(null);

		assertThatThrownBy(() -> userService.updateNickname(
				"ghost@gmail.com", new NicknameUpdateRequest("새닉네임")))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_NOT_FOUND);
	}
}
