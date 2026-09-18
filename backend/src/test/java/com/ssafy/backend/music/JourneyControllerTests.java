package com.ssafy.backend.music;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.stream.IntStream;

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
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.music.controller.JourneyController;
import com.ssafy.backend.music.dto.JourneyResponse;
import com.ssafy.backend.music.dto.JourneyStop;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.service.JourneyService;
import com.ssafy.backend.security.JwtAuthenticationFilter;

/**
 * 경로 탐색 컨트롤러 슬라이스 테스트. quickstart C절.
 * 실제 MVC 바인딩·검증, 공통 GlobalExceptionHandler 매핑, Jackson flat 직렬화(정본 §3.3)를 실측한다.
 *
 * <p>슬라이스 구성은 003 MusicDetailControllerTests 와 같다 — SecurityConfig·JwtAuthenticationFilter 를 제외한다.
 */
@WebMvcTest(controllers = JourneyController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class JourneyControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private JourneyService journeyService;





	private static Location loc() {
		return new Location(-0.4213, 1.0872, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.123);
	}

	private static MusicDetail song(long id, String mbid, String youtubeUrl, int duration) {
		return new MusicDetail(id, mbid, "Love wins all", "IU", 128.4, duration, "The Winning", 2024,
				List.of("K-Pop"), youtubeUrl, null, loc(), 1428, 3);
	}

	/** 정거장 n개 + 양 끝 = n+2 곡 경로. */
	private static JourneyResponse journey(int stationCount) {
		List<JourneyStop> path = new java.util.ArrayList<>();
		path.add(new JourneyStop(0, song(10234L, "b1a9c0e9", "https://youtu.be/a", 275)));
		IntStream.range(0, stationCount).forEach(i -> path
				.add(new JourneyStop(i + 1, song(1000L + i, "s" + i, "https://youtu.be/s" + i, 100))));
		path.add(new JourneyStop(stationCount + 1, song(10877L, "zz-end", "https://youtu.be/z", 205)));
		int total = 275 + stationCount * 100 + 205;
		return new JourneyResponse(path.size(), total, path);
	}

	// ------------------------------------------------------------------ C1 성공

	@Test
	void journey_success_returnsFlatPath() throws Exception {
		when(journeyService.getJourney(eq(10234L), eq(10877L))).thenReturn(journey(10));

		mockMvc.perform(get("/api/music/journey").param("start", "10234").param("end", "10877"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.error").doesNotExist())
				.andExpect(jsonPath("$.data.musicCnt").value(12))
				.andExpect(jsonPath("$.data.totalDuration").value(1480))
				.andExpect(jsonPath("$.data.path.length()").value(12))
				// @JsonUnwrapped: MusicDetail 필드가 path 원소 top-level 에 flat
				.andExpect(jsonPath("$.data.path[0].step").value(0))
				.andExpect(jsonPath("$.data.path[0].id").value(10234))
				.andExpect(jsonPath("$.data.path[0].mbid").value("b1a9c0e9"))
				.andExpect(jsonPath("$.data.path[0].bpm").value(128.4))
				.andExpect(jsonPath("$.data.path[0].duration").value(275))
				.andExpect(jsonPath("$.data.path[0].album").value("The Winning"))
				.andExpect(jsonPath("$.data.path[0].genres[0]").value("K-Pop"))
				.andExpect(jsonPath("$.data.path[0].location.pc1").value(-0.4213))
				.andExpect(jsonPath("$.data.path[0].location.pc16").value(-0.123))
				.andExpect(jsonPath("$.data.path[0].playCnt").value(1428))
				.andExpect(jsonPath("$.data.path[0].youtubeCnt").value(3))
				.andExpect(jsonPath("$.data.path[11].step").value(11))
				.andExpect(jsonPath("$.data.path[11].id").value(10877));
	}

	/** I9 — 엔진 메타가 응답에 새어나오지 않는다 (FR-023, 2026-09-10 clarify). */
	@Test
	void journey_engineMetaNotExposed() throws Exception {
		when(journeyService.getJourney(anyLong(), anyLong())).thenReturn(journey(10));

		mockMvc.perform(get("/api/music/journey").param("start", "10234").param("end", "10877"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.far").doesNotExist())
				.andExpect(jsonPath("$.data.endpointDist").doesNotExist())
				.andExpect(jsonPath("$.data.endpoint_dist").doesNotExist())
				.andExpect(jsonPath("$.data.mode").doesNotExist())
				.andExpect(jsonPath("$.data.nStations").doesNotExist())
				.andExpect(jsonPath("$.data.n_stations").doesNotExist())
				.andExpect(jsonPath("$.data.bundle").doesNotExist())
				.andExpect(jsonPath("$.data.reachable").doesNotExist())
				.andExpect(jsonPath("$.data.rules").doesNotExist())
				.andExpect(jsonPath("$.data.path[0].rank").doesNotExist())
				.andExpect(jsonPath("$.data.path[0].progress").doesNotExist())
				.andExpect(jsonPath("$.data.path[0].distFromPrev").doesNotExist());
	}

	@Test
	void journey_notPlayableSongKeptInPath() throws Exception {
		List<JourneyStop> path = List.of(
				new JourneyStop(0, song(10234L, "b1a9c0e9", "https://youtu.be/a", 275)),
				new JourneyStop(1, song(1000L, "s0", null, 100)),
				new JourneyStop(2, song(10877L, "zz-end", "https://youtu.be/z", 205)));
		when(journeyService.getJourney(anyLong(), anyLong()))
				.thenReturn(new JourneyResponse(3, 580, path));

		mockMvc.perform(get("/api/music/journey").param("start", "10234").param("end", "10877"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.path[1].id").value(1000))
				.andExpect(jsonPath("$.data.path[1].youtubeUrl").value(nullValue()));
	}

	// ------------------------------------------------------------------ C2 경계

	@Test
	void journey_sameStartAndEnd_returnsSingleSong() throws Exception {
		JourneyResponse single = new JourneyResponse(1, 275,
				List.of(new JourneyStop(0, song(10234L, "b1a9c0e9", "https://youtu.be/a", 275))));
		when(journeyService.getJourney(eq(10234L), eq(10234L))).thenReturn(single);

		mockMvc.perform(get("/api/music/journey").param("start", "10234").param("end", "10234"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.musicCnt").value(1))
				.andExpect(jsonPath("$.data.totalDuration").value(275))
				.andExpect(jsonPath("$.data.path.length()").value(1))
				.andExpect(jsonPath("$.data.path[0].step").value(0));
	}

	@Test
	void journey_twentyStations_returns22Songs() throws Exception {
		when(journeyService.getJourney(anyLong(), anyLong())).thenReturn(journey(20));

		mockMvc.perform(get("/api/music/journey").param("start", "10234").param("end", "10877"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.musicCnt").value(22))
				.andExpect(jsonPath("$.data.path.length()").value(22))
				.andExpect(jsonPath("$.data.path[21].step").value(21));
	}

	// -------------------------------------------------------------- C3 오류 매핑

	@Test
	void journey_missingStart_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/journey").param("end", "10877"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.data").doesNotExist())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
		verifyNoInteractions(journeyService);
	}

	@Test
	void journey_missingEnd_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/journey").param("start", "10234"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
		verifyNoInteractions(journeyService);
	}

	@Test
	void journey_startZero_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/journey").param("start", "0").param("end", "10877"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
		verifyNoInteractions(journeyService);
	}

	@Test
	void journey_endZero_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/journey").param("start", "10234").param("end", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
		verifyNoInteractions(journeyService);
	}

	@Test
	void journey_nonNumericStart_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/journey").param("start", "abc").param("end", "10877"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
		verifyNoInteractions(journeyService);
	}

	@Test
	void journey_songNotFound_returns404() throws Exception {
		when(journeyService.getJourney(eq(999L), anyLong()))
				.thenThrow(new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));

		mockMvc.perform(get("/api/music/journey").param("start", "999").param("end", "10877"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.data").doesNotExist())
				.andExpect(jsonPath("$.error.code").value("MUSIC_NOT_FOUND"));
	}

	@Test
	void journey_unreachable_returns422PathNotFound() throws Exception {
		when(journeyService.getJourney(anyLong(), anyLong()))
				.thenThrow(new CustomException(MusicErrorCode.PATH_NOT_FOUND));

		mockMvc.perform(get("/api/music/journey").param("start", "10234").param("end", "10877"))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.data").doesNotExist())
				.andExpect(jsonPath("$.error.code").value("PATH_NOT_FOUND"))
				.andExpect(jsonPath("$.error.message").value("두 곡을 연결하는 경로를 찾을 수 없습니다."));
	}

	/** 엔진 부재를 422 로 내리지 않는다 (2026-09-10 clarify). */
	@Test
	void journey_engineUnavailable_returns500Not422() throws Exception {
		when(journeyService.getJourney(anyLong(), anyLong()))
				.thenThrow(new CustomException(GlobalErrorCode.INTERNAL_SERVER_ERROR));

		mockMvc.perform(get("/api/music/journey").param("start", "10234").param("end", "10877"))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("INTERNAL_SERVER_ERROR"));
	}

	@Test
	void journey_unexpectedException_returns500() throws Exception {
		when(journeyService.getJourney(anyLong(), anyLong())).thenThrow(new RuntimeException("boom"));

		mockMvc.perform(get("/api/music/journey").param("start", "10234").param("end", "10877"))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.error.code").value("INTERNAL_SERVER_ERROR"));
	}


}
