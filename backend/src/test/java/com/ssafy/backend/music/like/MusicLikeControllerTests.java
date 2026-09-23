package com.ssafy.backend.music.like;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.security.JwtAuthenticationFilter;

@WebMvcTest(controllers = MusicLikeController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
        excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class MusicLikeControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MusicLikeService service;

    @Test
    void like_usesAuthenticatedUser() throws Exception {
        when(service.change(any(MusicLikeRequest.class), eq("me@example.com")))
                .thenReturn(new MusicLikeResponse(7, true, OffsetDateTime.parse("2026-09-21T10:00:00+09:00")));

        mockMvc.perform(post("/api/music/like")
                        .principal(new UsernamePasswordAuthenticationToken("me@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"musicId\":7,\"liked\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.musicId").value(7))
                .andExpect(jsonPath("$.data.liked").value(true));
    }

    @Test
    void like_missingState_returnsInvalidInput() throws Exception {
        mockMvc.perform(post("/api/music/like")
                        .principal(new UsernamePasswordAuthenticationToken("me@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"musicId\":7}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
    }

    @Test
    void liked_returnsVirtualPlaylistOrder() throws Exception {
        LikedMusicItem item = new LikedMusicItem(7, "title", "artist", 180,
                "https://youtube.test/7", "video7", OffsetDateTime.parse("2026-09-21T10:00:00+09:00"));
        when(service.findAll("me@example.com")).thenReturn(new LikedMusicResponse(List.of(item)));

        mockMvc.perform(get("/api/music/liked")
                        .principal(new UsernamePasswordAuthenticationToken("me@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].musicId").value(7))
                .andExpect(jsonPath("$.data.content[0].videoId").value("video7"));
    }
}
