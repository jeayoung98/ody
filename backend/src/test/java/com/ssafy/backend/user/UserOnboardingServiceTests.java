package com.ssafy.backend.user;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.user.mapper.UserMapper;
import com.ssafy.backend.user.service.UserService;

/**
 * 온보딩 완료 처리 유닛 (S15P21A405-122). 실제 tutorial_completed=true 전환은 UserMapper.updateTutorialCompleted에
 * 위임하고, 서비스는 email을 그대로 전달하는지만 확인한다.
 */
class UserOnboardingServiceTests {

	private final UserMapper userMapper = mock(UserMapper.class);
	private final AuthMapper authMapper = mock(AuthMapper.class);
	private final UserService userService = new UserService(userMapper, authMapper);

	@Test
	void completeTutorial_delegatesToMapperWithTokenSubjectEmail() {
		userService.completeTutorial("me@gmail.com");

		verify(userMapper).updateTutorialCompleted("me@gmail.com");
	}
}
