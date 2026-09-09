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
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.music.controller.MusicController;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MajorResponse;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.service.MusicService;

@WebMvcTest(MusicController.class)
class MusicControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private MusicService musicService;

	@Test
	void major_level1_returnsSuccessEnvelope() throws Exception {
		MusicDetail sample = new MusicDetail(
				10234L, "b1a9c0e9", "Love wins all", "IU", 128.4, 275, "The Winning",
				List.of("K-Pop"), "https://youtu.be/x",
				new Location(-0.4213, 1.0872, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.123),
				1428, 3);
		when(musicService.getMajor(anyInt(), any())).thenReturn(new MajorResponse(List.of(sample)));

		mockMvc.perform(get("/music/major").param("level", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.error").doesNotExist())
				.andExpect(jsonPath("$.data.content[0].id").value(10234))
				.andExpect(jsonPath("$.data.content[0].title").value("Love wins all"))
				.andExpect(jsonPath("$.data.content[0].genres[0]").value("K-Pop"))
				.andExpect(jsonPath("$.data.content[0].location.pc1").value(-0.4213));
	}

	@Test
	void major_invalidLevel_returnsValidationError() throws Exception {
		mockMvc.perform(get("/music/major").param("level", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
	}

	@Test
	void major_nonNumericLevel_returnsValidationError() throws Exception {
		mockMvc.perform(get("/music/major").param("level", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
	}
}
