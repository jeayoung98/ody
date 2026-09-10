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

import com.ssafy.backend.test.mapper.TestMapper;
import com.ssafy.backend.music.controller.MusicController;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.PageResponse;
import com.ssafy.backend.music.service.MusicService;

/**
 * 검색 컨트롤러 슬라이스 테스트 (@WebMvcTest). 실제 MVC 검증·공통 GlobalExceptionHandler 동작 검증.
 * 에러코드는 master GlobalErrorCode 기준.
 * ponytail: master @MapperScan이 슬라이스에 testMapper를 끌어와 SqlSessionFactory 부재로 실패 →
 * 해당 매퍼만 @MockitoBean으로 대체(BE-infra 소스 무수정). 근본 해결은 T301(@MapperScan 분리).
 */
@WebMvcTest(MusicController.class)
class MusicSearchControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private MusicService musicService;

	@MockitoBean
	private TestMapper testMapper;

	private static MusicSummary song(long id, String title, String artist, String youtubeUrl) {
		return new MusicSummary(id, title, artist, "The Winning", List.of("K-Pop"), youtubeUrl,
				new Location(-0.4213, 1.0872, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.123));
	}

	@Test
	void search_success_returnsPagedEnvelope() throws Exception {
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
		when(musicService.search(anyString(), anyInt()))
				.thenReturn(new PageResponse<>(List.of(), 0, 10, 0, 0, false));

		mockMvc.perform(get("/music/search").param("query", "zzzznomatch").param("page", "0"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.content").isArray())
				.andExpect(jsonPath("$.data.content").isEmpty());
	}

	@Test
	void search_blankQuery_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/music/search").param("query", "   ").param("page", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void search_missingQuery_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/music/search").param("page", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void search_negativePage_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/music/search").param("query", "IU").param("page", "-1"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void search_nonNumericPage_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/music/search").param("query", "IU").param("page", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void search_internalFailure_returns500() throws Exception {
		when(musicService.search(anyString(), anyInt())).thenThrow(new RuntimeException("boom"));

		mockMvc.perform(get("/music/search").param("query", "IU").param("page", "0"))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.data").doesNotExist())
				.andExpect(jsonPath("$.error.code").value("INTERNAL_SERVER_ERROR"));
	}
}
