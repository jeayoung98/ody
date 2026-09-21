package com.ssafy.backend.playlist;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.PlaylistErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.playlist.controller.PlaylistController;
import com.ssafy.backend.playlist.dto.PlaylistCreateResponse;
import com.ssafy.backend.playlist.dto.LikedPlaylistSummary;
import com.ssafy.backend.playlist.dto.PlaylistDetailResponse;
import com.ssafy.backend.playlist.dto.PlaylistLikeRequest;
import com.ssafy.backend.playlist.dto.PlaylistLikeResponse;
import com.ssafy.backend.playlist.dto.PlaylistMusicDeleteResponse;
import com.ssafy.backend.playlist.dto.PlaylistMusicInsertResponse;
import com.ssafy.backend.playlist.dto.PlaylistMusicReorderResponse;
import com.ssafy.backend.playlist.dto.PlaylistSummary;
import com.ssafy.backend.playlist.dto.PlaylistUpdateResponse;
import com.ssafy.backend.playlist.service.PlaylistService;
import com.ssafy.backend.security.JwtAuthenticationFilter;

/**
 * 플레이리스트 컨트롤러 슬라이스 테스트 (@WebMvcTest). mapper mock 이유는 MusicSearchControllerTests 참조.
 * SecurityConfig를 슬라이스에서 빼는 대신 토큰 주체를 MockMvc principal로 직접 주입한다(UserDetailControllerTests와 동일).
 */
@WebMvcTest(controllers = PlaylistController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class PlaylistControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private PlaylistService playlistService;





	private static UsernamePasswordAuthenticationToken principal(String email) {
		return new UsernamePasswordAuthenticationToken(
				email, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
	}

	@Test
	void searchLiked_returnsContentWithOwnerInfo() throws Exception {
		when(playlistService.searchLiked(eq("me@gmail.com"), eq("me@gmail.com")))
				.thenReturn(List.of(new LikedPlaylistSummary(
						42, "새벽 드라이브", 18, 4, "owner@gmail.com", "철수형",
						OffsetDateTime.parse("2026-09-07T13:41:02+09:00"))));

		mockMvc.perform(get("/api/playlist/liked")
						.param("email", "me@gmail.com")
						.principal(principal("me@gmail.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.content[0].playlistId").value(42))
				.andExpect(jsonPath("$.data.content[0].likeCnt").value(4))
				.andExpect(jsonPath("$.data.content[0].ownerEmail").value("owner@gmail.com"))
				.andExpect(jsonPath("$.data.content[0].ownerNickname").value("철수형"))
				.andExpect(jsonPath("$.data.content[0].likedAt").exists());
	}

	@Test
	void changeLike_delegatesTokenSubjectAndReturnsNewCount() throws Exception {
		when(playlistService.changeLike(any(PlaylistLikeRequest.class), eq("me@gmail.com")))
				.thenReturn(new PlaylistLikeResponse(7, true, 4));

		mockMvc.perform(post("/api/playlist/like")
						.principal(principal("me@gmail.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"playlistId\":7,\"liked\":true}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.liked").value(true))
				.andExpect(jsonPath("$.data.likeCnt").value(4));

		verify(playlistService).changeLike(any(PlaylistLikeRequest.class), eq("me@gmail.com"));
	}

	@Test
	void changeLike_missingLiked_returns400InvalidInput() throws Exception {
		mockMvc.perform(post("/api/playlist/like")
						.principal(principal("me@gmail.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"playlistId\":7}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void search_success_returnsContentArray() throws Exception {
		when(playlistService.search(eq("owner@gmail.com"), eq("me@gmail.com")))
				.thenReturn(List.of(new PlaylistSummary(42, "새벽 드라이브", 18, null)));

		mockMvc.perform(get("/api/playlist/search").param("email", "owner@gmail.com").principal(principal("me@gmail.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.content[0].playlistId").value(42))
				.andExpect(jsonPath("$.data.content[0].musicCnt").value(18));
	}

	@Test
	void detail_forbidden_returns403() throws Exception {
		when(playlistService.getDetail(eq(42L), eq("me@gmail.com")))
				.thenThrow(new CustomException(GlobalErrorCode.FORBIDDEN));

		mockMvc.perform(get("/api/playlist/detail").param("playlistId", "42").principal(principal("me@gmail.com")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
	}

	@Test
	void detail_success_returnsMusics() throws Exception {
		Location loc = new Location(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
		MusicDetail track = new MusicDetail(1L, "mbid", "제목", "가수", 120.0, 200, "앨범", "album-mbid", 2005,
				"https://youtu.be/x", null, loc, 10, 1);
		when(playlistService.getDetail(eq(42L), eq("me@gmail.com")))
				.thenReturn(new PlaylistDetailResponse(42, "드라이브", 1, 200, 9, true, List.of(track)));

		mockMvc.perform(get("/api/playlist/detail").param("playlistId", "42").principal(principal("me@gmail.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.musicCnt").value(1))
				.andExpect(jsonPath("$.data.likeCnt").value(9))
				.andExpect(jsonPath("$.data.isLiked").value(true))
				.andExpect(jsonPath("$.data.musics[0].id").value(1));
	}

	@Test
	void create_success_returns201() throws Exception {
		when(playlistService.create(eq("me@gmail.com"), eq("출근길"), eq(List.of())))
				.thenReturn(new PlaylistCreateResponse(43, "출근길", 0));

		mockMvc.perform(post("/api/playlist/create")
						.contentType(MediaType.APPLICATION_JSON)
						.principal(principal("me@gmail.com"))
						.content("{\"playlistName\":\"출근길\",\"musicIdList\":[]}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.data.playlistId").value(43));
	}

	@Test
	void create_duplicateName_returns409() throws Exception {
		when(playlistService.create(eq("me@gmail.com"), eq("출근길"), eq(List.of())))
				.thenThrow(new CustomException(PlaylistErrorCode.PLAYLIST_NAME_DUPLICATED));

		mockMvc.perform(post("/api/playlist/create")
						.contentType(MediaType.APPLICATION_JSON)
						.principal(principal("me@gmail.com"))
						.content("{\"playlistName\":\"출근길\",\"musicIdList\":[]}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.error.code").value("PLAYLIST_NAME_DUPLICATED"));
	}

	@Test
	void insertMusic_success() throws Exception {
		when(playlistService.insertMusic(eq(42L), eq(List.of(1L, 2L)), eq("me@gmail.com")))
				.thenReturn(new PlaylistMusicInsertResponse(42, 1, 1, List.of(1L), 6));

		mockMvc.perform(post("/api/playlist/music/insert")
						.contentType(MediaType.APPLICATION_JSON)
						.principal(principal("me@gmail.com"))
						.content("{\"playlistId\":42,\"musicIdList\":[1,2]}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.insertedCnt").value(1))
				.andExpect(jsonPath("$.data.skippedMusicIds[0]").value(1));
	}

	@Test
	void insertMusic_emptyList_returnsInvalidInput() throws Exception {
		mockMvc.perform(post("/api/playlist/music/insert")
						.contentType(MediaType.APPLICATION_JSON)
						.principal(principal("me@gmail.com"))
						.content("{\"playlistId\":42,\"musicIdList\":[]}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}

	@Test
	void deleteMusic_success() throws Exception {
		when(playlistService.deleteMusic(eq(42L), eq(List.of(1L)), eq("me@gmail.com")))
				.thenReturn(new PlaylistMusicDeleteResponse(42, 1, 18));

		mockMvc.perform(post("/api/playlist/music/delete")
						.contentType(MediaType.APPLICATION_JSON)
						.principal(principal("me@gmail.com"))
						.content("{\"playlistId\":42,\"musicIdList\":[1]}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.deletedCnt").value(1))
				.andExpect(jsonPath("$.data.musicCnt").value(18));
	}

	@Test
	void reorderMusic_success() throws Exception {
		when(playlistService.reorderMusic(eq(42L), eq(List.of(2L, 1L)), eq("me@gmail.com")))
				.thenReturn(new PlaylistMusicReorderResponse(42, 2));

		mockMvc.perform(post("/api/playlist/music/reorder")
						.contentType(MediaType.APPLICATION_JSON)
						.principal(principal("me@gmail.com"))
						.content("{\"playlistId\":42,\"musicIdList\":[2,1]}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.musicCnt").value(2));
	}

	@Test
	void update_success() throws Exception {
		when(playlistService.update(eq(42L), eq("새벽 드라이브 v2"), eq("me@gmail.com")))
				.thenReturn(new PlaylistUpdateResponse(42, "새벽 드라이브 v2", 19));

		mockMvc.perform(patch("/api/playlist/update")
						.contentType(MediaType.APPLICATION_JSON)
						.principal(principal("me@gmail.com"))
						.content("{\"playlistId\":42,\"playlistName\":\"새벽 드라이브 v2\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.playlistName").value("새벽 드라이브 v2"));
	}

	@Test
	void delete_success_returns200() throws Exception {
		mockMvc.perform(delete("/api/playlist/delete/42").principal(principal("me@gmail.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data").doesNotExist());

		verify(playlistService).delete(42, "me@gmail.com");
	}

	@Test
	void delete_notFound_returns404() throws Exception {
		org.mockito.Mockito.doThrow(new CustomException(PlaylistErrorCode.PLAYLIST_NOT_FOUND))
				.when(playlistService).delete(999, "me@gmail.com");

		mockMvc.perform(delete("/api/playlist/delete/999").principal(principal("me@gmail.com")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.error.code").value("PLAYLIST_NOT_FOUND"));
	}
}
