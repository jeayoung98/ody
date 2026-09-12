package com.ssafy.backend.music;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;
import java.util.ArrayList;

import org.mockito.ArgumentCaptor;
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
import com.ssafy.backend.music.dto.MajorResponse;
import com.ssafy.backend.music.dto.MapPoint;
import com.ssafy.backend.music.retrieval.LayerBox;
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

	/** D18: 응답 원소는 MapPoint 다. 1레이어는 범위 파라미터 없이 호출한다(FR-004). */
	private static final double[] PCS = { 0.11, -0.22, 0.33, -0.44, 0.55, -0.66, 0.77, -0.88,
			0.99, -1.10, 1.21, -1.32, 1.43, -1.54, 1.65, -1.76 };

	private static MapPoint point(long musicId) {
		List<Double> pc = new ArrayList<>();
		for (double v : PCS) {
			pc.add(v);
		}
		return new MapPoint(musicId, pc, 0, 0, "Love wins all", "IU", false);
	}

	@Test
	void major_level1_returnsSuccessEnvelope() throws Exception {
		when(musicService.getMajor(anyInt(), any())).thenReturn(new MajorResponse(List.of(point(10234L))));

		mockMvc.perform(get("/api/music/major").param("level", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.error").doesNotExist())
				.andExpect(jsonPath("$.data.content[0].musicId").value(10234))
				.andExpect(jsonPath("$.data.content[0].title").value("Love wins all"))
				.andExpect(jsonPath("$.data.content[0].genreId").value(0))
				.andExpect(jsonPath("$.data.content[0].playable").value(false));
	}

	/** A2 (FR-007): pc 는 정확히 16개이고 곡 기준선 좌표와 값이 같다. */
	@Test
	void major_successItem_carriesPc16AndBaselineCoordinates() throws Exception {
		when(musicService.getMajor(anyInt(), any())).thenReturn(new MajorResponse(List.of(point(10234L))));

		ResultActions result = mockMvc.perform(get("/api/music/major").param("level", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.content[0].pc.length()").value(16));

		for (int i = 0; i < PCS.length; i++) {
			result.andExpect(jsonPath("$.data.content[0].pc[" + i + "]").value(PCS[i]));
		}
	}

	/** D18: 상세 필드는 담지 않는다 — /music/detail 담당이다. ghostOnly 도 서버가 보내지 않는다. */
	@Test
	void major_itemOmitsDetailFields() throws Exception {
		when(musicService.getMajor(anyInt(), any())).thenReturn(new MajorResponse(List.of(point(55L))));

		mockMvc.perform(get("/api/music/major").param("level", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.content[0].bpm").doesNotExist())
				.andExpect(jsonPath("$.data.content[0].genres").doesNotExist())
				.andExpect(jsonPath("$.data.content[0].youtubeCnt").doesNotExist())
				.andExpect(jsonPath("$.data.content[0].ghostOnly").doesNotExist());
	}

	/** D19: level>=2 는 이전 겹들의 사각 범위를 전부 받는다. 레이어 n 은 pc(2n-1)·pc(2n) 축이다. */
	@Test
	void major_level2_parsesAccumulatedRangeIntoLayerBox() throws Exception {
		when(musicService.getMajor(anyInt(), any())).thenReturn(new MajorResponse(List.of()));

		mockMvc.perform(get("/api/music/major")
				.param("level", "2")
				.param("pc1min", "-1.5").param("pc1max", "0.5")
				.param("pc2min", "-0.25").param("pc2max", "2.0"))
				.andExpect(status().isOk());

		ArgumentCaptor<List<LayerBox>> boxes = ArgumentCaptor.forClass(List.class);
		verify(musicService).getMajor(eq(2), boxes.capture());
		assertEquals(List.of(new LayerBox(1, -1.5, -0.25, 0.5, 2.0)), boxes.getValue());
	}

	/** level>=2 에서 범위가 빠지면 400. 값 자체의 오류 규칙(min>max 등)은 B1 미정이라 다루지 않는다. */
	@Test
	void major_level2_withoutRange_returnsInvalidInput() throws Exception {
		mockMvc.perform(get("/api/music/major").param("level", "2"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	/**
	 * ⚠️ 잠정 검증 (B1 미정) — 확정된 수용 기준이 아니다.
	 *
	 * spec Edge Cases 는 level=0·음수·상한 초과의 허용 범위를 P1(B1) 미정으로 두었고
	 * 컨트롤러의 {@code @Min(1)} 을 정책 근거로 삼지 말라고 명시한다(헌법 IX).
	 * 이 테스트는 현재 구현 동작의 회귀 방지일 뿐이며, B1 확정 시 기대값을 그때 규범으로 교체한다.
	 * 커버리지를 유지하기 위해 삭제하지 않는다.
	 */
	@Test
	void major_level0_currentMinConstraintRejects_provisionalUntilB1() throws Exception {
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
