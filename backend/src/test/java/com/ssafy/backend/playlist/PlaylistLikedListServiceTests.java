package com.ssafy.backend.playlist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.playlist.dto.LikedPlaylistRow;
import com.ssafy.backend.playlist.dto.LikedPlaylistSummary;
import com.ssafy.backend.playlist.dto.PlaylistDetailResponse;
import com.ssafy.backend.playlist.dto.PlaylistRow;
import com.ssafy.backend.playlist.mapper.PlaylistMapper;
import com.ssafy.backend.playlist.service.PlaylistService;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.mapper.UserMapper;

/**
 * 좋아요한 플레이리스트 목록과 상세의 좋아요 상태 (S15P21A405-447).
 *
 * isLiked 는 플레이리스트 소유자가 아니라 요청자 기준이라는 점이 핵심이다.
 */
class PlaylistLikedListServiceTests {

	private final PlaylistMapper playlistMapper = mock(PlaylistMapper.class);
	private final UserMapper userMapper = mock(UserMapper.class);

	private final PlaylistService playlistService =
			new PlaylistService(playlistMapper, userMapper, Optional.of(mock(MusicDetailReader.class)));

	private static UserProfileRow user(String email, boolean isPublic) {
		UserProfileRow row = new UserProfileRow();
		row.setEmail(email);
		row.setIsPublic(isPublic);
		return row;
	}

	private static LikedPlaylistRow likedRow(long id, String name, String ownerEmail) {
		LikedPlaylistRow row = new LikedPlaylistRow();
		row.setId(id);
		row.setName(name);
		row.setMusicCnt(18);
		row.setLikeCnt(4);
		row.setOwnerEmail(ownerEmail);
		row.setOwnerNickname("철수형");
		row.setLikedAt(OffsetDateTime.parse("2026-09-07T13:41:02+09:00"));
		return row;
	}

	private static PlaylistRow playlist(long id, String ownerEmail) {
		PlaylistRow row = new PlaylistRow();
		row.setId(id);
		row.setOwnerEmail(ownerEmail);
		row.setName("드라이브");
		return row;
	}

	@Test
	void searchLiked_returnsOwnerInfoAndLikeCount() {
		when(userMapper.findProfileByEmail("me@gmail.com")).thenReturn(user("me@gmail.com", true));
		when(playlistMapper.findLikedSummariesByEmail("me@gmail.com"))
				.thenReturn(List.of(likedRow(42, "새벽 드라이브", "owner@gmail.com")));

		List<LikedPlaylistSummary> result = playlistService.searchLiked("me@gmail.com", "me@gmail.com");

		assertThat(result).hasSize(1);
		LikedPlaylistSummary first = result.get(0);
		assertThat(first.playlistId()).isEqualTo(42);
		assertThat(first.playlistName()).isEqualTo("새벽 드라이브");
		assertThat(first.musicCnt()).isEqualTo(18);
		assertThat(first.likeCnt()).isEqualTo(4);
		assertThat(first.ownerEmail()).isEqualTo("owner@gmail.com");
		assertThat(first.ownerNickname()).isEqualTo("철수형");
		assertThat(first.likedAt()).isNotNull();
	}

	@Test
	void searchLiked_nothingLiked_returnsEmptyList() {
		when(userMapper.findProfileByEmail("me@gmail.com")).thenReturn(user("me@gmail.com", true));
		when(playlistMapper.findLikedSummariesByEmail("me@gmail.com")).thenReturn(List.of());

		assertThat(playlistService.searchLiked("me@gmail.com", "me@gmail.com")).isEmpty();
	}

	@Test
	void searchLiked_unknownUser_throwsUserNotFound() {
		when(userMapper.findProfileByEmail("ghost@gmail.com")).thenReturn(null);

		assertThatThrownBy(() -> playlistService.searchLiked("ghost@gmail.com", "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_NOT_FOUND);

		verify(playlistMapper, never()).findLikedSummariesByEmail(anyString());
	}

	@Test
	void searchLiked_privateOtherUser_throwsUserPrivate() {
		when(userMapper.findProfileByEmail("you@gmail.com")).thenReturn(user("you@gmail.com", false));

		assertThatThrownBy(() -> playlistService.searchLiked("you@gmail.com", "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_PRIVATE);
	}

	@Test
	void searchLiked_privateSelf_isAllowed() {
		when(userMapper.findProfileByEmail("me@gmail.com")).thenReturn(user("me@gmail.com", false));
		when(playlistMapper.findLikedSummariesByEmail("me@gmail.com"))
				.thenReturn(List.of(likedRow(42, "새벽 드라이브", "owner@gmail.com")));

		assertThat(playlistService.searchLiked("me@gmail.com", "me@gmail.com")).hasSize(1);
	}

	@Test
	void getDetail_includesLikeCountAndRequesterLikeState() {
		when(playlistMapper.findById(42L)).thenReturn(playlist(42, "me@gmail.com"));
		when(playlistMapper.findMusicIdsInOrder(42L)).thenReturn(List.of());
		when(playlistMapper.findLikeCnt(42L)).thenReturn(9);
		when(playlistMapper.existsLike(42L, "me@gmail.com")).thenReturn(true);

		PlaylistDetailResponse result = playlistService.getDetail(42L, "me@gmail.com");

		assertThat(result.likeCnt()).isEqualTo(9);
		assertThat(result.isLiked()).isTrue();
	}

	@Test
	void getDetail_notLiked_isLikedIsFalse() {
		when(playlistMapper.findById(42L)).thenReturn(playlist(42, "me@gmail.com"));
		when(playlistMapper.findMusicIdsInOrder(42L)).thenReturn(List.of());
		when(playlistMapper.findLikeCnt(42L)).thenReturn(0);
		when(playlistMapper.existsLike(42L, "me@gmail.com")).thenReturn(false);

		PlaylistDetailResponse result = playlistService.getDetail(42L, "me@gmail.com");

		assertThat(result.likeCnt()).isZero();
		assertThat(result.isLiked()).isFalse();
	}
}
