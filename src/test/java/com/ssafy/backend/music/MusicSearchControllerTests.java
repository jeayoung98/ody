package com.ssafy.backend.music;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.music.controller.MusicController;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.PageResponse;
import com.ssafy.backend.music.service.MusicService;

/**
 * 검색 컨트롤러 슬라이스 테스트 (quickstart A1/A5/A6·E1/E2/E3/E5). 서비스는 mock.
 */
@WebMvcTest(MusicController.class)
class MusicSearchControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private MusicService musicService;

	private static MusicSummary song(long id, String title, String artist, String youtubeUrl) {
		return new MusicSummary(id, title, artist, "The Winning", List.of("K-Pop"), youtubeUrl,
				new Location(-0.4213, 1.0872, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.123));
	}

	@Test
	void search_success_returnsPagedEnvelope() throws Exception {
		// A1: 성공 응답 구조 + 페이지 정보
		PageResponse<MusicSummary> page = new PageResponse<>(
				List.of(song(10234L, "Love wins all", "IU", "https://youtu.be/x")),
				0, 10, 137, 14, true);
		when(musicService.search(eq("IU"), eq(0))).thenReturn(page);

		mockMvc.perform(get("/music/search").param("query", "IU").param("page", "0"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.error").doesNotExist())
				.andExpect(jsonPath("$.data.content[0].id").value(10234))
				.andExpect(jsonPath("$.data.content[0].location.pc1").value(-0.4213))
				.andExpect(jsonPath("$.data.page").value(0))
				.andExpect(jsonPath("$.data.size").value(10))
				.andExpect(jsonPath("$.data.totalElements").value(137))
				.andExpect(jsonPath("$.data.hasNext").value(true));
	}

	@Test
	void search_preservesServiceOrder() throws Exception {
		// A5: 서비스가 준 순서(youtubeCnt DESC·id ASC 결과)를 컨트롤러가 그대로 전달
		PageResponse<MusicSummary> page = new PageResponse<>(
				List.of(song(1L, "A", "x", "https://y/1"), song(2L, "B", "y", "https://y/2")),
				0, 10, 2, 1, false);
		when(musicService.search(anyString(), anyInt())).thenReturn(page);

		mockMvc.perform(get("/music/search").param("query", "wins").param("page", "0"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.content[0].id").value(1))
				.andExpect(jsonPath("$.data.content[1].id").value(2));
	}

	@Test
	void search_emptyResult_returns200EmptyContent() throws Exception {
		// E3: 매칭 0건 → 200 + 빈 content (오류 아님)
		when(musicService.search(anyString(), anyInt()))
				.thenReturn(new PageResponse<>(List.of(), 0, 10, 0, 0, false));

		mockMvc.perform(get("/music/search").param("query", "zzzznomatch").param("page", "0"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.content").isArray())
				.andExpect(jsonPath("$.data.content").isEmpty());
	}

	@Test
	void search_blankQuery_returnsValidationError() throws Exception {
		// E1: 공백 query → 400 VALIDATION_ERROR
		mockMvc.perform(get("/music/search").param("query", "   ").param("page", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
	}

	@Test
	void search_missingQuery_returnsValidationError() throws Exception {
		// E1: query 누락 → 400 VALIDATION_ERROR
		mockMvc.perform(get("/music/search").param("page", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
	}

	@Test
	void search_negativePage_returnsValidationError() throws Exception {
		// E2: page 음수 → 400
		mockMvc.perform(get("/music/search").param("query", "IU").param("page", "-1"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
	}

	@Test
	void search_nonNumericPage_returnsValidationError() throws Exception {
		// E2: page 비정수 → 400
		mockMvc.perform(get("/music/search").param("query", "IU").param("page", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
	}

	@Test
	void search_internalFailure_returns500() throws Exception {
		// E5: 서비스/port 예외 → 500 INTERNAL_ERROR + 공통 실패 구조
		when(musicService.search(anyString(), anyInt())).thenThrow(new RuntimeException("boom"));

		mockMvc.perform(get("/music/search").param("query", "IU").param("page", "0"))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.data").doesNotExist())
				.andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"));
	}
}
