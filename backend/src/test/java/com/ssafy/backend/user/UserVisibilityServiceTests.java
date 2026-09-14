package com.ssafy.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.user.dto.PublicVisibilityUpdateRequest;
import com.ssafy.backend.user.dto.PublicVisibilityUpdateResponse;
import com.ssafy.backend.user.mapper.UserMapper;
import com.ssafy.backend.user.service.UserService;

/**
 * 공개 설정(is_public) 변경 서비스 유닛 (S15P21A405-300).
 */
class UserVisibilityServiceTests {

	private final UserMapper userMapper = mock(UserMapper.class);
	private final AuthMapper authMapper = mock(AuthMapper.class);
	private final UserService userService = new UserService(userMapper, authMapper);

	@Test
	void updatePublicVisibility_toPrivate_updatesAndReturnsFalse() {
		PublicVisibilityUpdateResponse result =
				userService.updatePublicVisibility("me@gmail.com", new PublicVisibilityUpdateRequest(false));

		assertThat(result.isPublic()).isFalse();
		verify(userMapper).updateIsPublic("me@gmail.com", false);
	}

	@Test
	void updatePublicVisibility_toPublic_updatesAndReturnsTrue() {
		PublicVisibilityUpdateResponse result =
				userService.updatePublicVisibility("me@gmail.com", new PublicVisibilityUpdateRequest(true));

		assertThat(result.isPublic()).isTrue();
		verify(userMapper).updateIsPublic("me@gmail.com", true);
	}

	@Test
	void updatePublicVisibility_nullIsPublic_throwsInvalidInput() {
		assertThatThrownBy(() -> userService.updatePublicVisibility(
				"me@gmail.com", new PublicVisibilityUpdateRequest(null)))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);
	}
}
