package com.ssafy.backend.taste;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
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
class TasteAnalysisGenerationControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TasteAnalysisQueryService queryService;

    @MockitoBean
    private TasteAnalysisGenerationService generationService;

    @Test
    void initialGenerated_usesAuthenticatedUserAndReturnsEnvelope() throws Exception {
        when(generationService.generate("me@example.com"))
                .thenReturn(response("INITIAL", "FRESH", "GENERATED", true));

        mockMvc.perform(post("/api/taste-analysis")
                        .principal(new UsernamePasswordAuthenticationToken("me@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.report.level").value("INITIAL"))
                .andExpect(jsonPath("$.data.report.aiGenerated").value(true))
                .andExpect(jsonPath("$.data.generation.status").value("GENERATED"));

        verify(generationService).generate("me@example.com");
    }

    @Test
    void standardGenerated_isReturnedWithoutChangingLevel() throws Exception {
        when(generationService.generate("me@example.com"))
                .thenReturn(response("STANDARD", "FRESH", "GENERATED", true));

        mockMvc.perform(post("/api/taste-analysis")
                        .principal(new UsernamePasswordAuthenticationToken("me@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.report.level").value("STANDARD"))
                .andExpect(jsonPath("$.data.generation.dailyLimitUsedToday").value(true));
    }

    @Test
    void fallback_isExplicitAndRetryable() throws Exception {
        when(generationService.generate("me@example.com"))
                .thenReturn(response("INITIAL", "FALLBACK", "FALLBACK", false));

        mockMvc.perform(post("/api/taste-analysis")
                        .principal(new UsernamePasswordAuthenticationToken("me@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("FALLBACK"))
                .andExpect(jsonPath("$.data.report.aiGenerated").value(false))
                .andExpect(jsonPath("$.data.generation.status").value("FALLBACK"))
                .andExpect(jsonPath("$.data.generation.canRetry").value(true));
    }

    private static TasteAnalysisResponse response(
            String level, String state, String generationStatus, boolean aiGenerated) {
        OffsetDateTime completedAt = OffsetDateTime.parse("2026-09-21T12:00:05+09:00");
        return new TasteAnalysisResponse(
                state,
                new TasteAnalysisResponse.Counts(30, 30, 0, Map.of()),
                new TasteAnalysisResponse.Eligibility(true, level, 0),
                "taste-v1",
                List.of(), List.of(),
                new TasteAnalysisResponse.Report(
                        level, aiGenerated, true, "요약", List.of(), completedAt, completedAt, completedAt),
                new TasteAnalysisResponse.Generation(
                        generationStatus, aiGenerated, aiGenerated, !aiGenerated,
                        aiGenerated ? null : "GMS_REQUEST_FAILED", null));
    }
}
