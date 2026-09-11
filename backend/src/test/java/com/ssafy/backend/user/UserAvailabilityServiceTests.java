package com.ssafy.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.user.service.UserAvailabilityService;

/**
 * 닉네임 사용 가능 여부 조회 유닛 (S15P21A405-121). AuthService.signup과 같은 길이 규칙(NicknamePolicy)을 공유한다.
 */
class UserAvailabilityServiceTests {

	private final AuthMapper authMapper = mock(AuthMapper.class);
	private final UserAvailabilityService service = new UserAvailabilityService(authMapper);

	@Test
	void isNicknameAvailable_notTaken_returnsTrue() {
		when(authMapper.existsByNickname("새닉네임")).thenReturn(false);

		assertThat(service.isNicknameAvailable("새닉네임")).isTrue();
	}

	@Test
	void isNicknameAvailable_taken_returnsFalse() {
		when(authMapper.existsByNickname("이미있음")).thenReturn(true);

		assertThat(service.isNicknameAvailable("이미있음")).isFalse();
	}

	@Test
	void isNicknameAvailable_tooShort_throwsInvalidNicknameLength() {
		assertThatThrownBy(() -> service.isNicknameAvailable("a"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.INVALID_NICKNAME_LENGTH);
	}

	@Test
	void isNicknameAvailable_tooLong_throwsInvalidNicknameLength() {
		String tooLong = "가".repeat(21);

		assertThatThrownBy(() -> service.isNicknameAvailable(tooLong))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.INVALID_NICKNAME_LENGTH);
	}
}
