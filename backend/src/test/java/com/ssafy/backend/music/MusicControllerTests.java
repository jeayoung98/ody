package com.ssafy.backend.music;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.test.mapper.TestMapper;
import com.ssafy.backend.playlist.mapper.PlaylistMapper;
import com.ssafy.backend.user.mapper.UserMapper;
import com.ssafy.backend.music.controller.MusicController;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MajorResponse;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.service.MusicService;

/**
 * 대표곡 컨트롤러 슬라이스 테스트 (@WebMvcTest). 에러코드는 master GlobalErrorCode 기준.
 * testMapper mock 이유는 MusicSearchControllerTests 참조(T301 전까지).
 */
// ponytail: master SecurityConfig가 슬라이스에 딸려와 security 빈 부재로 컨텍스트가 죽는다 →
// JwtAuthenticationFilter는 Filter라 슬라이스에 스캔된다. 둘 다 제외하고 기본 시큐리티 필터도 끈다(BE-infra 소스 무수정).
@WebMvcTest(controllers = MusicController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class MusicControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private MusicService musicService;

	@MockitoBean
	private TestMapper testMapper;

	@MockitoBean
	private AuthMapper authMapper;

	@MockitoBean
	private UserMapper userMapper;

	@MockitoBean
	private PlaylistMapper playlistMapper;

	@Test
	void major_level1_returnsSuccessEnvelope() throws Exception {
		MusicDetail sample = new MusicDetail(
				10234L, "b1a9c0e9", "Love wins all", "IU", 128.4, 275, "The Winning",
				List.of("K-Pop"), "https://youtu.be/x",
				new Location(-0.4213, 1.0872, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.123),
				1428, 3);
		when(musicService.getMajor(anyInt(), any())).thenReturn(new MajorResponse(List.of(sample)));

		mockMvc.perform(get("/api/music/major").param("level", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.error").doesNotExist())
				.andExpect(jsonPath("$.data.content[0].id").value(10234))
				.andExpect(jsonPath("$.data.content[0].title").value("Love wins all"))
				.andExpect(jsonPath("$.data.content[0].genres[0]").value("K-Pop"))
				.andExpect(jsonPath("$.data.content[0].location.pc1").value(-0.4213));
	}

	@Test
	void major_invalidLevel_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/major").param("level", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void major_nonNumericLevel_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/major").param("level", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}
}
