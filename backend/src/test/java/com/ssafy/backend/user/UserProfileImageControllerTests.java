package com.ssafy.backend.user;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.user.controller.UserProfileImageController;
import com.ssafy.backend.user.dto.ProfileImageUpdateResponse;
import com.ssafy.backend.user.service.ProfileImageService;

/**
 * 프로필 이미지 수정 컨트롤러 슬라이스 (S15P21A405-426). 대상 사용자는 요청 본문이 아니라 토큰 주체에서 온다.
 */
@WebMvcTest(controllers = UserProfileImageController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class UserProfileImageControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private ProfileImageService profileImageService;

	private static UsernamePasswordAuthenticationToken principal(String email) {
		return new UsernamePasswordAuthenticationToken(
				email, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
	}

	private static MockMultipartFile pngPart() {
		byte[] bytes = new byte[16];
		byte[] signature = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A };
		System.arraycopy(signature, 0, bytes, 0, signature.length);
		return new MockMultipartFile("file", "avatar.png", "image/png", bytes);
	}

	@Test
	void updateImage_delegatesTokenSubjectAndReturnsUrl() throws Exception {
		when(profileImageService.updateImage(eq("me@gmail.com"), any()))
				.thenReturn(new ProfileImageUpdateResponse("https://example.test/api/user/images/new.png"));

		mockMvc.perform(multipart(HttpMethod.PATCH, "/api/user/image")
						.file(pngPart())
						.principal(principal("me@gmail.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.imageUrl").value("https://example.test/api/user/images/new.png"));

		verify(profileImageService).updateImage(eq("me@gmail.com"), any());
	}

	@Test
	void updateImage_unsupportedFormat_returns400InvalidImageFile() throws Exception {
		when(profileImageService.updateImage(eq("me@gmail.com"), any()))
				.thenThrow(new CustomException(UserErrorCode.INVALID_IMAGE_FILE));

		mockMvc.perform(multipart(HttpMethod.PATCH, "/api/user/image")
						.file(new MockMultipartFile("file", "a.txt", "text/plain", "hello".getBytes()))
						.principal(principal("me@gmail.com")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("INVALID_IMAGE_FILE"));
	}

	@Test
	void updateImage_missingFilePart_returns400InvalidInput() throws Exception {
		mockMvc.perform(multipart(HttpMethod.PATCH, "/api/user/image")
						.principal(principal("me@gmail.com")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}
}
