package com.ssafy.backend.user;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.test.mapper.TestMapper;
import com.ssafy.backend.user.controller.UserAvailabilityController;
import com.ssafy.backend.playlist.mapper.PlaylistMapper;
import com.ssafy.backend.user.mapper.UserMapper;
import com.ssafy.backend.user.service.UserAvailabilityService;

/**
 * 닉네임 사용 가능 여부 컨트롤러 슬라이스 테스트 (@WebMvcTest). mapper mock 이유는 MusicSearchControllerTests 참조.
 */
@WebMvcTest(controllers = UserAvailabilityController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class UserAvailabilityControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private UserAvailabilityService userAvailabilityService;

	@MockitoBean
	private TestMapper testMapper;

	@MockitoBean
	private AuthMapper authMapper;

	@MockitoBean
	private UserMapper userMapper;

	@MockitoBean
	private PlaylistMapper playlistMapper;

	@Test
	void nicknameAvailable_available_returnsTrue() throws Exception {
		when(userAvailabilityService.isNicknameAvailable(eq("새닉네임"))).thenReturn(true);

		mockMvc.perform(get("/api/users/nickname-available").param("nickname", "새닉네임"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.available").value(true));
	}

	@Test
	void nicknameAvailable_taken_returnsFalse() throws Exception {
		when(userAvailabilityService.isNicknameAvailable(eq("이미있음"))).thenReturn(false);

		mockMvc.perform(get("/api/users/nickname-available").param("nickname", "이미있음"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.available").value(false));
	}

	@Test
	void nicknameAvailable_missingParam_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/users/nickname-available"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void nicknameAvailable_invalidLength_returns400NicknameLength() throws Exception {
		when(userAvailabilityService.isNicknameAvailable(eq("a")))
				.thenThrow(new CustomException(AuthErrorCode.INVALID_NICKNAME_LENGTH));

		mockMvc.perform(get("/api/users/nickname-available").param("nickname", "a"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_NICKNAME_LENGTH"));
	}
}
