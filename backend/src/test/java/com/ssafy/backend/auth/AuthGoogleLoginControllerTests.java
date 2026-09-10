package com.ssafy.backend.auth;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.auth.controller.AuthController;
import com.ssafy.backend.auth.dto.GoogleLoginResult;
import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.auth.service.AuthService;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.security.JwtTokenProvider;
import com.ssafy.backend.security.TokenPair;
import com.ssafy.backend.test.mapper.TestMapper;
import com.ssafy.backend.user.mapper.UserMapper;

/**
 * 구글 idToken 로그인 컨트롤러 슬라이스 테스트 (S15P21A405-122). mapper mock 이유는 MusicSearchControllerTests 참조.
 * AuthController는 JwtTokenProvider도 실빈으로 물고 있어(쿠키 만료시간 계산용) 슬라이스에서 mock으로 대체한다.
 */
@WebMvcTest(controllers = AuthController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class AuthGoogleLoginControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private AuthService authService;

	@MockitoBean
	private JwtTokenProvider jwtTokenProvider;

	@MockitoBean
	private TestMapper testMapper;

	@MockitoBean
	private AuthMapper authMapper;

	@MockitoBean
	private UserMapper userMapper;

	@Test
	void loginWithGoogle_newUser_returnsIsNewUserTrue() throws Exception {
		when(jwtTokenProvider.getRefreshTokenExpirationMs()).thenReturn(1_209_600_000L);
		when(authService.loginWithGoogleIdToken(eq("valid-token"))).thenReturn(new GoogleLoginResult(
				new TokenPair("access-token", "refresh-token"),
				true,
				new GoogleLoginResult.UserInfo("new@gmail.com", "홍길동", null, "https://lh3.example/pic.png")));

		mockMvc.perform(post("/api/auth/login/google")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"idToken\":\"valid-token\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.accessToken").value("access-token"))
				.andExpect(jsonPath("$.data.isNewUser").value(true))
				.andExpect(jsonPath("$.data.user.email").value("new@gmail.com"))
				.andExpect(jsonPath("$.data.user.nickname").doesNotExist());
	}

	@Test
	void loginWithGoogle_invalidToken_returns401OauthFailed() throws Exception {
		when(authService.loginWithGoogleIdToken(eq("bad-token")))
				.thenThrow(new CustomException(AuthErrorCode.OAUTH_FAILED));

		mockMvc.perform(post("/api/auth/login/google")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"idToken\":\"bad-token\"}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.error.code").value("OAUTH_FAILED"));
	}

	@Test
	void loginWithGoogle_missingIdToken_returnsInvalidInput() throws Exception {
		mockMvc.perform(post("/api/auth/login/google")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}
}
