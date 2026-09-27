package com.ssafy.backend.music;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.music.controller.MusicController;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.NearbyCenter;
import com.ssafy.backend.music.dto.NearbyResponse;
import com.ssafy.backend.music.dto.NeighborTrack;
import com.ssafy.backend.music.service.MusicService;
import com.ssafy.backend.music.service.NearbyService;
import com.ssafy.backend.security.JwtAuthenticationFilter;

/**
 * 주변 탐색 컨트롤러 슬라이스 테스트 (quickstart D). 실제 MVC 검증·공통 예외 매핑·Jackson 직렬화를 실측한다.
 *
 * <p>슬라이스 구성은 003 선례를 그대로 따른다 — SecurityConfig 와 JwtAuthenticationFilter 를 제외하지 않으면
 * security 빈 부재로 컨텍스트가 죽는다.
 */
@WebMvcTest(controllers = MusicController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class NearbyControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private MusicService musicService;

	@MockitoBean
	private NearbyService nearbyService;

	private static Location loc() {
		return new Location(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
	}

	private static NearbyResponse sample() {
		return new NearbyResponse(
				new NearbyCenter(1000000L, "Manifesto", "CCCP", loc()),
				List.of(new NeighborTrack(
						new MusicSummary(1024529L, "The Last Dj", "Tom Petty", null,
								"https://y/x", null, loc()),
						"b2c1f7e0", 2.4643)),
				false);
	}

	@Test
	@DisplayName("D1 정상 — 200 과 공통 성공 봉투, 이웃에 거리가 실린다")
	void d1_success() throws Exception {
		when(nearbyService.findNearby(1000000L)).thenReturn(sample());

		mockMvc.perform(get("/api/music/nearby").param("id", "1000000"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.error").doesNotExist())
				.andExpect(jsonPath("$.data.center.id").value(1000000))
				.andExpect(jsonPath("$.data.center.location.pc16").value(16.0))
				.andExpect(jsonPath("$.data.neighbors[0].id").value(1024529))
				// 주변곡 커버를 여는 열쇠 (S15P21A405-711)
				.andExpect(jsonPath("$.data.neighbors[0].albumMbid").value("b2c1f7e0"))
				.andExpect(jsonPath("$.data.neighbors[0].distance").value(2.4643))
				.andExpect(jsonPath("$.data.lowSimilarity").value(false));
	}

	@Test
	@DisplayName("D4 id 가 0 이하면 400 INVALID_INPUT 이고 서비스를 부르지 않는다")
	void d4_zeroId() throws Exception {
		mockMvc.perform(get("/api/music/nearby").param("id", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));

		verify(nearbyService, never()).findNearby(anyLong());
	}

	@Test
	@DisplayName("D4 id 가 정수가 아니면 400 INVALID_INPUT")
	void d4_nonNumericId() throws Exception {
		mockMvc.perform(get("/api/music/nearby").param("id", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	@DisplayName("D3 id 가 없으면 400 INVALID_INPUT")
	void d3_missingId() throws Exception {
		mockMvc.perform(get("/api/music/nearby"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	@DisplayName("C5 없는 곡이면 404 MUSIC_NOT_FOUND")
	void c5_notFound() throws Exception {
		when(nearbyService.findNearby(999999999L))
				.thenThrow(new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));

		mockMvc.perform(get("/api/music/nearby").param("id", "999999999"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.error.code").value("MUSIC_NOT_FOUND"));
	}

	@Test
	@DisplayName("D6 모든 실패는 success:false · data:null · error 구조를 지킨다")
	void d6_failureEnvelope() throws Exception {
		mockMvc.perform(get("/api/music/nearby").param("id", "0"))
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.data").doesNotExist())
				.andExpect(jsonPath("$.error.code").exists())
				.andExpect(jsonPath("$.error.message").exists());
	}

	@Test
	@DisplayName("C4 이웃이 비어도 200 이고 유사도 낮음이 붙는다")
	void c4_emptyIsSuccess() throws Exception {
		when(nearbyService.findNearby(1L)).thenReturn(new NearbyResponse(
				new NearbyCenter(1L, "T", "A", loc()), List.of(), true));

		mockMvc.perform(get("/api/music/nearby").param("id", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.neighbors").isEmpty())
				.andExpect(jsonPath("$.data.lowSimilarity").value(true));
	}
}
