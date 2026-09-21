package com.ssafy.backend.taste;

import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import com.ssafy.backend.taste.service.TasteAnalysisQueryService;
import com.ssafy.backend.taste.service.TasteAnalysisGenerationService;

@WebMvcTest(controllers = TasteAnalysisController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
        excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class TasteAnalysisQueryControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TasteAnalysisQueryService service;

    @MockitoBean
    private TasteAnalysisGenerationService generationService;

    @Test
    void get_usesAuthenticatedUser() throws Exception {
        TasteAnalysisResponse response = new TasteAnalysisResponse(
                "EMPTY",
                new TasteAnalysisResponse.Counts(0, 0, 0, Map.of()),
                new TasteAnalysisResponse.Eligibility(false, null, 10),
                new TasteAnalysisResponse.ReferenceVersions("bundle", "reference", "labels", "taste-v1"),
                List.of(), List.of(), null,
                new TasteAnalysisResponse.Generation("INELIGIBLE", false, false, false, null, null));
        when(service.get("me@example.com")).thenReturn(response);

        mockMvc.perform(get("/api/taste-analysis")
                        .principal(new UsernamePasswordAuthenticationToken("me@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("EMPTY"))
                .andExpect(jsonPath("$.data.reportEligibility.additionalLikesNeeded").value(10));
    }

    @Test
    void post_generatesForAuthenticatedUser() throws Exception {
        TasteAnalysisResponse response = new TasteAnalysisResponse(
                "FALLBACK",
                new TasteAnalysisResponse.Counts(10, 10, 0, Map.of()),
                new TasteAnalysisResponse.Eligibility(true, "INITIAL", 0),
                new TasteAnalysisResponse.ReferenceVersions("bundle", "reference", "labels", "taste-v1"),
                List.of(), List.of(), null,
                new TasteAnalysisResponse.Generation(
                        "FALLBACK", false, false, true, "GMS_REQUEST_FAILED", null));
        when(generationService.generate("me@example.com")).thenReturn(response);

        mockMvc.perform(post("/api/taste-analysis")
                        .principal(new UsernamePasswordAuthenticationToken("me@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.generation.status").value("FALLBACK"));

        verify(generationService).generate("me@example.com");
    }
}
