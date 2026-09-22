package com.ssafy.backend.taste;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.TasteErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.taste.controller.TasteAnalysisController;
import com.ssafy.backend.taste.dto.TasteAnalysisResponse;
import com.ssafy.backend.taste.service.TasteAnalysisGenerationService;
import com.ssafy.backend.taste.service.TasteAnalysisQueryService;

@WebMvcTest(controllers = TasteAnalysisController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
        excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class TasteAnalysisStateControllerTests {

    private static final String EMAIL = "me@example.com";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TasteAnalysisQueryService queryService;

    @MockitoBean
    private TasteAnalysisGenerationService generationService;

    @Test
    void get_returnsFreshState() throws Exception {
        when(queryService.get(EMAIL)).thenReturn(response("FRESH", "NOT_REQUESTED", null));

        performGet("FRESH", "NOT_REQUESTED");
    }

    @Test
    void get_returnsStaleState() throws Exception {
        when(queryService.get(EMAIL)).thenReturn(response("STALE", "NOT_REQUESTED", null));

        performGet("STALE", "NOT_REQUESTED");
    }

    @Test
    void get_returnsInProgressAndLeaseExpiry() throws Exception {
        OffsetDateTime retryAt = OffsetDateTime.parse("2026-09-21T12:01:00+09:00");
        when(queryService.get(EMAIL)).thenReturn(response("IN_PROGRESS", "IN_PROGRESS", retryAt));

        mockMvc.perform(get("/api/taste-analysis").principal(principal()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.generation.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.generation.nextAvailableAt")
                        .value("2026-09-21T12:01:00+09:00"));
    }

    @Test
    void post_dailyLimit_returns429AndNextKstMidnight() throws Exception {
        String retryAt = "2026-09-22T00:00+09:00";
        when(generationService.generate(EMAIL)).thenThrow(new CustomException(
                TasteErrorCode.TASTE_DAILY_LIMIT, Map.of("nextAvailableAt", retryAt)));

        mockMvc.perform(post("/api/taste-analysis").principal(principal()))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.code").value("TASTE_DAILY_LIMIT"))
                .andExpect(jsonPath("$.error.details.nextAvailableAt").value(retryAt));
    }

    @Test
    void post_activeClaim_returns409AndLeaseExpiry() throws Exception {
        String retryAt = "2026-09-21T12:01+09:00";
        when(generationService.generate(EMAIL)).thenThrow(new CustomException(
                TasteErrorCode.TASTE_ANALYSIS_IN_PROGRESS, Map.of("nextAvailableAt", retryAt)));

        mockMvc.perform(post("/api/taste-analysis").principal(principal()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("TASTE_ANALYSIS_IN_PROGRESS"))
                .andExpect(jsonPath("$.error.details.nextAvailableAt").value(retryAt));
    }

    private void performGet(String state, String generationStatus) throws Exception {
        mockMvc.perform(get("/api/taste-analysis").principal(principal()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value(state))
                .andExpect(jsonPath("$.data.generation.status").value(generationStatus));
    }

    private static UsernamePasswordAuthenticationToken principal() {
        return new UsernamePasswordAuthenticationToken(EMAIL, null);
    }

    private static TasteAnalysisResponse response(
            String state, String generationStatus, OffsetDateTime nextAvailableAt) {
        OffsetDateTime completedAt = OffsetDateTime.parse("2026-09-21T11:00:00+09:00");
        return new TasteAnalysisResponse(
                state,
                new TasteAnalysisResponse.Counts(10, 10, 0, Map.of()),
                new TasteAnalysisResponse.Eligibility(true, "INITIAL", 0),
                "taste-v1",
                List.of(), List.of(),
                new TasteAnalysisResponse.Report(
                        "INITIAL", true, "FRESH".equals(state), "요약", List.of(),
                        completedAt, completedAt, completedAt),
                new TasteAnalysisResponse.Generation(
                        generationStatus, false, false, false, null, nextAvailableAt));
    }
}
