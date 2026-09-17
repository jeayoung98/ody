package com.ssafy.backend.report;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.report.controller.MusicReportController;
import com.ssafy.backend.report.dto.MusicReportResponse;
import com.ssafy.backend.report.service.MusicReportService;
import com.ssafy.backend.security.JwtAuthenticationFilter;

/** 음원 신고 컨트롤러 슬라이스 (S15P21A405-388, FeedbackControllerTests 와 같은 구성). */
@WebMvcTest(controllers = MusicReportController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
        excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class MusicReportControllerTests {

    private static final String BODY = """
            {"musicId":10234,"reason":"noise","detailReason":"소리가 안 들려요"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MusicReportService musicReportService;

    @Test
    void report_loggedIn_passesEmail() throws Exception {
        when(musicReportService.report(any(), eq("me@gmail.com"))).thenReturn(new MusicReportResponse(7));
        mockMvc.perform(post("/api/music/report").contentType(MediaType.APPLICATION_JSON).content(BODY)
                        .principal(new UsernamePasswordAuthenticationToken(
                                "me@gmail.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reportId").value(7));
    }

    @Test
    void report_anonymous_passesNullEmail() throws Exception {
        when(musicReportService.report(any(), isNull())).thenReturn(new MusicReportResponse(8));
        mockMvc.perform(post("/api/music/report").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reportId").value(8));
    }

    @Test
    void report_musicNotFound_returns404() throws Exception {
        when(musicReportService.report(any(), isNull()))
                .thenThrow(new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));

        mockMvc.perform(post("/api/music/report").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("MUSIC_NOT_FOUND"));
    }

    /** S15P21A405-398 — reason @Pattern 제약 제거로 spoken|noise|other 외 값도 허용된다. */
    @Test
    void report_arbitraryReason_accepted() throws Exception {
        when(musicReportService.report(any(), isNull())).thenReturn(new MusicReportResponse(9));

        mockMvc.perform(post("/api/music/report").contentType(MediaType.APPLICATION_JSON)
                        .content(BODY.replace("\"noise\"", "\"random\"")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reportId").value(9));
    }

    @Test
    void report_missingReason_returns400() throws Exception {
        mockMvc.perform(post("/api/music/report").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"musicId":10234}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
    }

    @Test
    void report_missingMusicId_returns400() throws Exception {
        mockMvc.perform(post("/api/music/report").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"noise"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
    }

    @Test
    void report_musicIdZero_returns400() throws Exception {
        mockMvc.perform(post("/api/music/report").contentType(MediaType.APPLICATION_JSON)
                        .content(BODY.replace("10234", "0")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
    }

    @Test
    void report_detailReasonTooLong_returns400() throws Exception {
        String tooLong = "a".repeat(2001);
        mockMvc.perform(post("/api/music/report").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"musicId\":10234,\"reason\":\"other\",\"detailReason\":\"" + tooLong + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
    }
}
