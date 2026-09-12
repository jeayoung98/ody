package com.ssafy.backend.music;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.music.controller.ConstellationController;
import com.ssafy.backend.music.dto.ConstellationLayoutResponse;
import com.ssafy.backend.music.dto.ConstellationPoint;
import com.ssafy.backend.music.service.ConstellationService;
import com.ssafy.backend.security.JwtAuthenticationFilter;

/**
 * 별자리 배치 컨트롤러 슬라이스 테스트 (quickstart Q14~Q17).
 * 공통 응답 봉투·Bean Validation 400·도메인 404 를 실제 MVC 스택으로 실측한다.
 */
// ponytail: MusicDetailControllerTests 와 같은 제외 설정. SecurityConfig 가 슬라이스에 딸려오면 빈 부재로 컨텍스트가 죽는다.
@WebMvcTest(controllers = ConstellationController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class ConstellationControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private ConstellationService constellationService;

	private static ConstellationLayoutResponse layout() {
		return new ConstellationLayoutResponse(List.of(
				new ConstellationPoint(10234L, 1.0, 0.1823),
				new ConstellationPoint(88123L, -0.4471, -0.9032),
				new ConstellationPoint(4412L, 0.2210, 0.6614),
				new ConstellationPoint(900001L, -0.7739, 0.0595)));
	}

	@Test
	void returnsPoints_inCommonEnvelope() throws Exception { // Q14 (FR-001)
		when(constellationService.layout(anyList())).thenReturn(layout());

		mockMvc.perform(post("/api/constellations/layout")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"musicIds\":[10234,88123,4412,900001]}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.error").value(nullValue()))
				.andExpect(jsonPath("$.data.points.length()").value(4))
				.andExpect(jsonPath("$.data.points[0].musicId").value(10234))
				.andExpect(jsonPath("$.data.points[0].x").value(1.0))
				.andExpect(jsonPath("$.data.points[0].y").value(0.1823));
	}

	@Test
	void ignoresClientSuppliedCoordinates() throws Exception { // Q15 (FR-003)
		when(constellationService.layout(anyList())).thenReturn(layout());

		// 프론트가 지금 우회용으로 함께 싣는 points. 받아도 응답이 달라지지 않아야 목 라우트를 걷어낼 수 있다.
		mockMvc.perform(post("/api/constellations/layout")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"musicIds\":[10234,88123,4412,900001],"
								+ "\"points\":[{\"musicId\":10234,\"pc\":[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]}]}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.points.length()").value(4))
				.andExpect(jsonPath("$.data.points[0].x").value(1.0))
				.andExpect(jsonPath("$.data.points[0].y").value(0.1823));
	}

	@Test
	void rejectsMissingMusicIds() throws Exception { // Q16 (FR-013)
		mockMvc.perform(post("/api/constellations/layout")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.data").value(nullValue()))
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void rejectsTooFewTracks() throws Exception { // Q16 (FR-013)
		mockMvc.perform(post("/api/constellations/layout")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"musicIds\":[10234]}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void missingTrack_becomes404() throws Exception { // Q17 (FR-014)
		when(constellationService.layout(anyList()))
				.thenThrow(new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));

		mockMvc.perform(post("/api/constellations/layout")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"musicIds\":[10234,99999999]}"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.data").value(nullValue()))
				.andExpect(jsonPath("$.error.code").value("MUSIC_NOT_FOUND"));
	}
}
