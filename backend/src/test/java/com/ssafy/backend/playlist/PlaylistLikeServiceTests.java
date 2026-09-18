package com.ssafy.backend.playlist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.PlaylistErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.playlist.dto.PlaylistLikeRequest;
import com.ssafy.backend.playlist.dto.PlaylistLikeResponse;
import com.ssafy.backend.playlist.dto.PlaylistRow;
import com.ssafy.backend.playlist.mapper.PlaylistMapper;
import com.ssafy.backend.playlist.service.PlaylistService;
import com.ssafy.backend.user.mapper.UserMapper;

/**
 * 플레이리스트 좋아요 유닛 (S15P21A405-442).
 *
 * 핵심은 "기록이 실제로 바뀐 경우에만 like_cnt 를 움직인다"는 것이다 — 연타하거나 같은 요청이
 * 재전송돼도 숫자가 부풀지 않아야 한다.
 */
class PlaylistLikeServiceTests {

	private final PlaylistMapper playlistMapper = mock(PlaylistMapper.class);
	private final UserMapper userMapper = mock(UserMapper.class);

	private final PlaylistService playlistService =
			new PlaylistService(playlistMapper, userMapper, Optional.of(mock(MusicDetailReader.class)));

	private static PlaylistRow playlist() {
		PlaylistRow row = new PlaylistRow();
		row.setId(7L);
		row.setOwnerEmail("owner@gmail.com");
		row.setName("드라이브");
		return row;
	}

	@Test
	void like_firstTime_incrementsCountAndReturnsNewValue() {
		when(playlistMapper.findById(7L)).thenReturn(playlist());
		when(playlistMapper.insertLike(7L, "me@gmail.com")).thenReturn(1);
		when(playlistMapper.findLikeCnt(7L)).thenReturn(4);

		PlaylistLikeResponse result =
				playlistService.changeLike(new PlaylistLikeRequest(7L, true), "me@gmail.com");

		assertThat(result.liked()).isTrue();
		assertThat(result.likeCnt()).isEqualTo(4);
		verify(playlistMapper).addLikeCnt(7L, 1);
	}

	@Test
	void like_alreadyLiked_doesNotIncrementAgain() {
		when(playlistMapper.findById(7L)).thenReturn(playlist());
		when(playlistMapper.insertLike(7L, "me@gmail.com")).thenReturn(0);
		when(playlistMapper.findLikeCnt(7L)).thenReturn(4);

		PlaylistLikeResponse result =
				playlistService.changeLike(new PlaylistLikeRequest(7L, true), "me@gmail.com");

		assertThat(result.liked()).isTrue();
		assertThat(result.likeCnt()).isEqualTo(4);
		verify(playlistMapper, never()).addLikeCnt(anyLong(), anyInt());
	}

	@Test
	void unlike_whenLiked_decrementsCount() {
		when(playlistMapper.findById(7L)).thenReturn(playlist());
		when(playlistMapper.deleteLike(7L, "me@gmail.com")).thenReturn(1);
		when(playlistMapper.findLikeCnt(7L)).thenReturn(3);

		PlaylistLikeResponse result =
				playlistService.changeLike(new PlaylistLikeRequest(7L, false), "me@gmail.com");

		assertThat(result.liked()).isFalse();
		assertThat(result.likeCnt()).isEqualTo(3);
		verify(playlistMapper).addLikeCnt(7L, -1);
	}

	@Test
	void unlike_whenNotLiked_doesNotDecrement() {
		when(playlistMapper.findById(7L)).thenReturn(playlist());
		when(playlistMapper.deleteLike(7L, "me@gmail.com")).thenReturn(0);
		when(playlistMapper.findLikeCnt(7L)).thenReturn(0);

		PlaylistLikeResponse result =
				playlistService.changeLike(new PlaylistLikeRequest(7L, false), "me@gmail.com");

		assertThat(result.likeCnt()).isZero();
		verify(playlistMapper, never()).addLikeCnt(anyLong(), anyInt());
	}

	@Test
	void like_othersPlaylist_isAllowed() {
		when(playlistMapper.findById(7L)).thenReturn(playlist());
		when(playlistMapper.insertLike(7L, "someone-else@gmail.com")).thenReturn(1);
		when(playlistMapper.findLikeCnt(7L)).thenReturn(1);

		PlaylistLikeResponse result =
				playlistService.changeLike(new PlaylistLikeRequest(7L, true), "someone-else@gmail.com");

		assertThat(result.likeCnt()).isEqualTo(1);
		verify(playlistMapper).insertLike(7L, "someone-else@gmail.com");
	}

	@Test
	void like_unknownPlaylist_throwsPlaylistNotFound() {
		when(playlistMapper.findById(404L)).thenReturn(null);

		assertThatThrownBy(() -> playlistService.changeLike(new PlaylistLikeRequest(404L, true), "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(PlaylistErrorCode.PLAYLIST_NOT_FOUND);

		verify(playlistMapper, never()).insertLike(anyLong(), anyString());
	}
}
