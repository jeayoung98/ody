package com.ssafy.backend.user;

import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.test.mapper.TestMapper;
import com.ssafy.backend.user.controller.UserOnboardingController;
import com.ssafy.backend.user.mapper.UserMapper;
import com.ssafy.backend.user.service.UserService;

/**
 * 온보딩 완료 컨트롤러 슬라이스 테스트 (S15P21A405-122). mapper mock 이유는 MusicSearchControllerTests 참조.
 * SecurityConfig를 슬라이스에서 빼는 대신 토큰 주체를 MockMvc principal로 직접 주입한다(UserDetailControllerTests와 동일).
 */
@WebMvcTest(controllers = UserOnboardingController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class UserOnboardingControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private UserService userService;

	@MockitoBean
	private TestMapper testMapper;

	@MockitoBean
	private AuthMapper authMapper;

	@MockitoBean
	private UserMapper userMapper;

	@Test
	void completeTutorial_authenticated_returnsTrueAndDelegatesTokenSubject() throws Exception {
		var principal = new UsernamePasswordAuthenticationToken(
				"me@gmail.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));

		mockMvc.perform(patch("/api/user/tutorial-completed").principal(principal))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.tutorialCompleted").value(true));

		verify(userService).completeTutorial("me@gmail.com");
	}
}
