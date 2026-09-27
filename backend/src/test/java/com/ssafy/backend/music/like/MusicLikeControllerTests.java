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

import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
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
        Location location = new Location(0.5, -0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0);
        MusicDetail music = new MusicDetail(7L, "mbid7", "title", "artist", 120.0, 180, "album",
                "album-mbid-7", 2024, "https://youtube.test/7", "video7", location, 42, 3);
        LikedMusicItem item = new LikedMusicItem(music, OffsetDateTime.parse("2026-09-21T10:00:00+09:00"));
        when(service.findAll("me@example.com")).thenReturn(new LikedMusicResponse(List.of(item)));

        mockMvc.perform(get("/api/music/liked")
                        .principal(new UsernamePasswordAuthenticationToken("me@example.com", null)))
                .andExpect(status().isOk())
                // 곡 필드는 MusicDetail 과 같은 모양으로 평평하게 나간다 — 플레이리스트 상세의 곡과 같다 [S15P21A405-650]
                .andExpect(jsonPath("$.data.content[0].id").value(7))
                .andExpect(jsonPath("$.data.content[0].music").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].videoId").value("video7"))
                .andExpect(jsonPath("$.data.content[0].location").exists())
                .andExpect(jsonPath("$.data.content[0].playCnt").value(42))
                .andExpect(jsonPath("$.data.content[0].albumMbid").value("album-mbid-7"))
                .andExpect(jsonPath("$.data.content[0].likedAt").exists());
    }

    /** 좌표가 없는 곡도 목록에서 빠지지 않는다. FE 는 그 곡만 별자리에서 뺀다. */
    @Test
    void liked_keepsTrackWithoutLocation() throws Exception {
        MusicDetail music = new MusicDetail(8L, null, "title", "artist", null, 180, null,
                null, null, null, null, null, null, null);
        LikedMusicItem item = new LikedMusicItem(music, OffsetDateTime.parse("2026-09-21T10:00:00+09:00"));
        when(service.findAll("me@example.com")).thenReturn(new LikedMusicResponse(List.of(item)));

        mockMvc.perform(get("/api/music/liked")
                        .principal(new UsernamePasswordAuthenticationToken("me@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(8))
                .andExpect(jsonPath("$.data.content[0].location").doesNotExist());
    }
}
