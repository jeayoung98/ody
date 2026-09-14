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

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.user.controller.UserVisibilityController;
import com.ssafy.backend.user.dto.PublicVisibilityUpdateRequest;
import com.ssafy.backend.user.dto.PublicVisibilityUpdateResponse;
import com.ssafy.backend.user.service.UserService;

/**
 * 공개 설정(is_public) 변경 컨트롤러 슬라이스 테스트 (S15P21A405-300). mapper mock 이유는
 * MusicSearchControllerTests 참조. SecurityConfig를 슬라이스에서 빼는 대신 토큰 주체를 MockMvc principal로
 * 직접 주입한다(UserProfileControllerTests와 동일).
 */
@WebMvcTest(controllers = UserVisibilityController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class UserVisibilityControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private UserService userService;

	private static UsernamePasswordAuthenticationToken principal(String email) {
		return new UsernamePasswordAuthenticationToken(
				email, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
	}

	@Test
	void updatePublicVisibility_toFalse_delegatesTokenSubjectAndReturnsResult() throws Exception {
		when(userService.updatePublicVisibility(eq("me@gmail.com"), any(PublicVisibilityUpdateRequest.class)))
				.thenReturn(new PublicVisibilityUpdateResponse(false));

		mockMvc.perform(patch("/api/user/public")
						.principal(principal("me@gmail.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"isPublic\":false}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.isPublic").value(false));

		verify(userService).updatePublicVisibility(eq("me@gmail.com"), any(PublicVisibilityUpdateRequest.class));
	}

	@Test
	void updatePublicVisibility_missingField_returns400InvalidInput() throws Exception {
		when(userService.updatePublicVisibility(eq("me@gmail.com"), any(PublicVisibilityUpdateRequest.class)))
				.thenThrow(new CustomException(GlobalErrorCode.INVALID_INPUT));

		mockMvc.perform(patch("/api/user/public")
						.principal(principal("me@gmail.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}
}
