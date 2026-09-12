package com.ssafy.backend.user;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
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

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.user.controller.UserController;
import com.ssafy.backend.user.dto.UserDetailResponse;
import com.ssafy.backend.user.service.UserService;

/**
 * 사용자 상세 컨트롤러 슬라이스 테스트 (@WebMvcTest). 실제 MVC 검증·공통 GlobalExceptionHandler 동작 검증.
 * mapper mock 이유는 MusicSearchControllerTests 참조(T301 전까지).
 * SecurityConfig를 슬라이스에서 빼는 대신, 토큰 주체를 MockMvc principal로 직접 주입해 Authentication 파라미터를 채운다.
 */
@WebMvcTest(controllers = UserController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class UserDetailControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private UserService userService;





	private static UsernamePasswordAuthenticationToken principal(String email) {
		return new UsernamePasswordAuthenticationToken(
				email, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
	}

	private static UserDetailResponse response(boolean isMe) {
		return new UserDetailResponse(
				"you@gmail.com", "김철수", "철수형", true, true,
				OffsetDateTime.parse("2026-09-07T13:41:02+09:00"),
				OffsetDateTime.parse("2026-08-21T09:12:44+09:00"),
				"https://cdn.example.com/profile/abc.png",
				0, 0, false, isMe);
	}

	@Test
	void detail_success_returnsUserDetailEnvelope() throws Exception {
		when(userService.getDetail(eq("you@gmail.com"), eq("me@gmail.com"))).thenReturn(response(false));

		mockMvc.perform(get("/api/user/detail").param("email", "you@gmail.com").principal(principal("me@gmail.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.error").doesNotExist())
				.andExpect(jsonPath("$.data.email").value("you@gmail.com"))
				.andExpect(jsonPath("$.data.tutorialCompleted").value(true))
				.andExpect(jsonPath("$.data.lastMusic").doesNotExist())
				.andExpect(jsonPath("$.data.isPublic").value(true))
				.andExpect(jsonPath("$.data.isMe").value(false));
	}

	@Test
	void detail_self_returnsIsMeTrue() throws Exception {
		when(userService.getDetail(eq("me@gmail.com"), eq("me@gmail.com"))).thenReturn(response(true));

		mockMvc.perform(get("/api/user/detail").param("email", "me@gmail.com").principal(principal("me@gmail.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.isMe").value(true));
	}

	@Test
	void detail_missingEmail_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/user/detail").principal(principal("me@gmail.com")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void detail_blankEmail_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/user/detail").param("email", "  ").principal(principal("me@gmail.com")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void detail_notFound_returns404UserNotFound() throws Exception {
		when(userService.getDetail(eq("nobody@gmail.com"), eq("me@gmail.com")))
				.thenThrow(new CustomException(UserErrorCode.USER_NOT_FOUND));

		mockMvc.perform(get("/api/user/detail").param("email", "nobody@gmail.com").principal(principal("me@gmail.com")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("USER_NOT_FOUND"));
	}

	@Test
	void detail_private_returns403UserPrivate() throws Exception {
		when(userService.getDetail(eq("you@gmail.com"), eq("me@gmail.com")))
				.thenThrow(new CustomException(UserErrorCode.USER_PRIVATE));

		mockMvc.perform(get("/api/user/detail").param("email", "you@gmail.com").principal(principal("me@gmail.com")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.error.code").value("USER_PRIVATE"));
	}
}
