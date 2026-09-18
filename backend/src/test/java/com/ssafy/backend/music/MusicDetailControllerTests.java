package com.ssafy.backend.music;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
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

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.music.controller.MusicController;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailResponse;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.NeighborTrack;
import com.ssafy.backend.music.service.MusicService;
import com.ssafy.backend.music.service.NearbyService;

/**
 * 상세 컨트롤러 슬라이스 테스트 (@WebMvcTest). 실제 MVC 검증·공통 GlobalExceptionHandler·Jackson 직렬화 검증.
 * @JsonUnwrapped flat 직렬화(정본 §3.2)를 jsonPath로 실측한다.
 */
// ponytail: master SecurityConfig가 슬라이스에 딸려와 security 빈 부재로 컨텍스트가 죽는다 →
// JwtAuthenticationFilter는 Filter라 슬라이스에 스캔된다. 둘 다 제외하고 기본 시큐리티 필터도 끈다(BE-infra 소스 무수정).
@WebMvcTest(controllers = MusicController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class MusicDetailControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private MusicService musicService;

	@MockitoBean
	private NearbyService nearbyService;





	private static Location loc() {
		return new Location(-0.4213, 1.0872, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.123);
	}

	private static MusicDetail detail(String youtubeUrl) {
		return new MusicDetail(10234L, "b1a9c0e9", "Love wins all", "IU", 128.4, 275, "The Winning", 2024,
				List.of("K-Pop"), youtubeUrl, null, loc(), 1428, 3);
	}

	private static NeighborTrack neighbor(long id, String youtubeUrl, double distance) {
		return new NeighborTrack(
				new MusicSummary(id, "Through the Night", "IU", "Palette", List.of("K-Pop"), youtubeUrl, null, loc()),
				distance);
	}

	@Test
	void detail_success_returnsFlatDetailWithNeighbors() throws Exception {
		MusicDetailResponse body = new MusicDetailResponse(detail("https://youtu.be/x"),
				List.of(neighbor(10877L, "https://youtu.be/y", 0.0412),
						neighbor(10999L, "https://youtu.be/z", 0.0510)), false);
		when(musicService.getDetail(eq(10234L))).thenReturn(body);

		mockMvc.perform(get("/api/music/detail").param("id", "10234"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.error").doesNotExist())
				// @JsonUnwrapped: 상세 필드가 data top-level에 flat
				.andExpect(jsonPath("$.data.id").value(10234))
				.andExpect(jsonPath("$.data.mbid").value("b1a9c0e9"))
				.andExpect(jsonPath("$.data.bpm").value(128.4))
				.andExpect(jsonPath("$.data.releaseYear").value(2024))
				.andExpect(jsonPath("$.data.location.pc1").value(-0.4213))
				.andExpect(jsonPath("$.data.playCnt").value(1428))
				// neighbors: MusicSummary 필드 flat + distance
				.andExpect(jsonPath("$.data.neighbors[0].id").value(10877))
				.andExpect(jsonPath("$.data.neighbors[0].artist").value("IU"))
				.andExpect(jsonPath("$.data.neighbors[0].location.pc16").value(-0.123))
				.andExpect(jsonPath("$.data.neighbors[0].distance").value(0.0412))
				.andExpect(jsonPath("$.data.neighbors[1].id").value(10999));
	}

	@Test
	void detail_targetNotPlayable_returns200WithNullUrl() throws Exception {
		when(musicService.getDetail(anyLong()))
				.thenReturn(new MusicDetailResponse(detail(null), List.of(), false));

		mockMvc.perform(get("/api/music/detail").param("id", "10234"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.id").value(10234))
				.andExpect(jsonPath("$.data.youtubeUrl").value(nullValue()))
				.andExpect(jsonPath("$.data.neighbors").isArray());
	}

	@Test
	void detail_neighborNotPlayable_keptInList() throws Exception {
		when(musicService.getDetail(anyLong()))
				.thenReturn(new MusicDetailResponse(detail("https://youtu.be/x"),
						List.of(neighbor(10877L, null, 0.0412)), false));

		mockMvc.perform(get("/api/music/detail").param("id", "10234"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.neighbors[0].id").value(10877))
				.andExpect(jsonPath("$.data.neighbors[0].youtubeUrl").value(nullValue()));
	}

	@Test
	void detail_notFound_returns404MusicNotFound() throws Exception {
		when(musicService.getDetail(eq(999L)))
				.thenThrow(new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));

		mockMvc.perform(get("/api/music/detail").param("id", "999"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.data").doesNotExist())
				.andExpect(jsonPath("$.error.code").value("MUSIC_NOT_FOUND"));
	}

	@Test
	void detail_idZero_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/detail").param("id", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void detail_nonNumericId_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/detail").param("id", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void detail_missingId_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/detail"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void detail_internalFailure_returns500() throws Exception {
		when(musicService.getDetail(anyLong())).thenThrow(new RuntimeException("boom"));

		mockMvc.perform(get("/api/music/detail").param("id", "10234"))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("INTERNAL_SERVER_ERROR"));
	}
}
