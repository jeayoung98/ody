package com.ssafy.backend.user;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
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
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.user.controller.UserProfileController;
import com.ssafy.backend.user.dto.UserProfileUpdateRequest;
import com.ssafy.backend.user.dto.UserProfileUpdateResponse;
import com.ssafy.backend.user.service.UserService;

/**
 * 프로필(닉네임/이미지) 수정 컨트롤러 슬라이스 테스트 (S15P21A405-216). mapper mock 이유는
 * MusicSearchControllerTests 참조. SecurityConfig를 슬라이스에서 빼는 대신 토큰 주체를 MockMvc principal로
 * 직접 주입한다(UserOnboardingControllerTests와 동일).
 */
@WebMvcTest(controllers = UserProfileController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class UserProfileControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private UserService userService;





	private static UsernamePasswordAuthenticationToken principal(String email) {
		return new UsernamePasswordAuthenticationToken(
				email, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
	}

	@Test
	void updateProfile_nicknameOnly_delegatesTokenSubjectAndReturnsResult() throws Exception {
		when(userService.updateProfile(eq("me@gmail.com"), any(UserProfileUpdateRequest.class)))
				.thenReturn(new UserProfileUpdateResponse("새닉네임", null));

		mockMvc.perform(patch("/api/user/profile")
						.principal(principal("me@gmail.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"nickname\":\"새닉네임\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.nickname").value("새닉네임"));

		verify(userService).updateProfile(eq("me@gmail.com"), any(UserProfileUpdateRequest.class));
	}

	@Test
	void updateProfile_duplicateNickname_returns409NicknameAlreadyExists() throws Exception {
		when(userService.updateProfile(eq("me@gmail.com"), any(UserProfileUpdateRequest.class)))
				.thenThrow(new CustomException(AuthErrorCode.NICKNAME_ALREADY_EXISTS));

		mockMvc.perform(patch("/api/user/profile")
						.principal(principal("me@gmail.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"nickname\":\"중복닉네임\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("NICKNAME_ALREADY_EXISTS"));
	}
}
