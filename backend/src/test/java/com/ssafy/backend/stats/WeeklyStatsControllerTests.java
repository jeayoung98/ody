package com.ssafy.backend.stats;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.stats.controller.WeeklyStatsController;
import com.ssafy.backend.stats.dto.RankedUser;
import com.ssafy.backend.stats.dto.WeeklyStatsResponse;
import com.ssafy.backend.stats.service.WeeklyStatsService;

/** 주간 랭킹 컨트롤러 슬라이스 (S15P21A405-448). */
@WebMvcTest(controllers = WeeklyStatsController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class WeeklyStatsControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private WeeklyStatsService weeklyStatsService;

	private static UsernamePasswordAuthenticationToken principal(String email) {
		return new UsernamePasswordAuthenticationToken(
				email, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
	}

	@Test
	void weekly_returnsThreeRankingsAndWeekBounds() throws Exception {
		when(weeklyStatsService.weekly()).thenReturn(new WeeklyStatsResponse(
				OffsetDateTime.parse("2026-09-14T00:00:00+09:00"),
				OffsetDateTime.parse("2026-09-21T00:00:00+09:00"),
				List.of(new RankedUser(1, "a@gmail.com", "철수형", "https://cdn.example.com/a.png", 9)),
				List.of(new RankedUser(1, "b@gmail.com", "영희", null, 120)),
				List.of(new RankedUser(1, "c@gmail.com", null, null, 3))));

		mockMvc.perform(get("/api/stats/weekly").principal(principal("me@gmail.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.weekStart").exists())
				.andExpect(jsonPath("$.data.weekEnd").exists())
				.andExpect(jsonPath("$.data.discovery[0].rank").value(1))
				.andExpect(jsonPath("$.data.discovery[0].nickname").value("철수형"))
				.andExpect(jsonPath("$.data.discovery[0].count").value(9))
				.andExpect(jsonPath("$.data.explore[0].count").value(120))
				.andExpect(jsonPath("$.data.contribution[0].count").value(3));
	}

	@Test
	void weekly_emptyRankings_returnsEmptyArrays() throws Exception {
		when(weeklyStatsService.weekly()).thenReturn(new WeeklyStatsResponse(
				OffsetDateTime.parse("2026-09-14T00:00:00+09:00"),
				OffsetDateTime.parse("2026-09-21T00:00:00+09:00"),
				List.of(), List.of(), List.of()));

		mockMvc.perform(get("/api/stats/weekly").principal(principal("me@gmail.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.discovery").isArray())
				.andExpect(jsonPath("$.data.discovery").isEmpty())
				.andExpect(jsonPath("$.data.explore").isEmpty())
				.andExpect(jsonPath("$.data.contribution").isEmpty());
	}
}
