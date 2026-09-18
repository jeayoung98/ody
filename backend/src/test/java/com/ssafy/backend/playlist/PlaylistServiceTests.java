package com.ssafy.backend.playlist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.common.PlaylistErrorCode;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.playlist.dto.PlaylistCreateResponse;
import com.ssafy.backend.playlist.dto.PlaylistDetailResponse;
import com.ssafy.backend.playlist.dto.PlaylistMusicDeleteResponse;
import com.ssafy.backend.playlist.dto.PlaylistMusicInsertItem;
import com.ssafy.backend.playlist.dto.PlaylistMusicInsertResponse;
import com.ssafy.backend.playlist.dto.PlaylistMusicReorderResponse;
import com.ssafy.backend.playlist.dto.PlaylistRow;
import com.ssafy.backend.playlist.dto.PlaylistSummary;
import com.ssafy.backend.playlist.dto.PlaylistSummaryRow;
import com.ssafy.backend.playlist.dto.PlaylistUpdateResponse;
import com.ssafy.backend.playlist.mapper.PlaylistMapper;
import com.ssafy.backend.playlist.service.PlaylistService;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.mapper.UserMapper;

/**
 * 플레이리스트 서비스 유닛 (S15P21A405-65/66/67). mock mapper. music 조회는 Optional 주입 —
 * 어댑터(BE4) 없을 때 UnsupportedOperationException, 있을 때 정상 동작 둘 다 검증한다.
 */
class PlaylistServiceTests {

	private final PlaylistMapper playlistMapper = mock(PlaylistMapper.class);
	private final UserMapper userMapper = mock(UserMapper.class);
	private final MusicDetailReader musicDetailReader = mock(MusicDetailReader.class);

	private PlaylistService serviceWithAdapter() {
		return new PlaylistService(playlistMapper, userMapper, Optional.of(musicDetailReader));
	}

	private PlaylistService serviceWithoutAdapter() {
		return new PlaylistService(playlistMapper, userMapper, Optional.empty());
	}

	private static UserProfileRow user(boolean isPublic) {
		UserProfileRow row = new UserProfileRow();
		row.setEmail("owner@gmail.com");
		row.setIsPublic(isPublic);
		return row;
	}

	private static PlaylistRow playlist(long id, String ownerEmail, String name) {
		PlaylistRow row = new PlaylistRow();
		row.setId(id);
		row.setOwnerEmail(ownerEmail);
		row.setName(name);
		return row;
	}

	private static MusicDetail music(long id, int duration) {
		// 곡마다 다른 좌표. 상세 응답이 좌표를 그대로 실어 보내는지 확인하려면 값이 구별돼야 한다.
		Location loc = new Location(id * 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, id * -0.25);
		return new MusicDetail(id, "mbid", "제목", "가수", 120.0, duration, "앨범", 2006,
				"https://youtu.be/x", null, loc, 10, 1);
	}

	// ---- search (§4.1) ----

	@Test
	void search_publicOwner_returnsSummaries() {
		when(userMapper.findProfileByEmail("owner@gmail.com")).thenReturn(user(true));
		PlaylistSummaryRow row = new PlaylistSummaryRow();
		row.setId(42);
		row.setName("새벽 드라이브");
		row.setMusicCnt(18);
		when(playlistMapper.findSummariesByOwnerEmail("owner@gmail.com")).thenReturn(List.of(row));

		List<PlaylistSummary> result = serviceWithAdapter().search("owner@gmail.com", "me@gmail.com");

		assertThat(result).hasSize(1);
		assertThat(result.get(0).playlistId()).isEqualTo(42);
		assertThat(result.get(0).musicCnt()).isEqualTo(18);
	}

	@Test
	void search_privateOwnerNotSelf_throwsUserPrivate() {
		when(userMapper.findProfileByEmail("owner@gmail.com")).thenReturn(user(false));

		assertThatThrownBy(() -> serviceWithAdapter().search("owner@gmail.com", "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_PRIVATE);
	}

	@Test
	void search_privateOwnerIsSelf_returnsSummaries() {
		when(userMapper.findProfileByEmail("owner@gmail.com")).thenReturn(user(false));
		when(playlistMapper.findSummariesByOwnerEmail("owner@gmail.com")).thenReturn(List.of());

		List<PlaylistSummary> result = serviceWithAdapter().search("owner@gmail.com", "owner@gmail.com");

		assertThat(result).isEmpty();
	}

	@Test
	void search_unknownEmail_throwsUserNotFound() {
		when(userMapper.findProfileByEmail("nobody@gmail.com")).thenReturn(null);

		assertThatThrownBy(() -> serviceWithAdapter().search("nobody@gmail.com", "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_NOT_FOUND);
	}

	// ---- getDetail (§4.2) ----

	@Test
	void getDetail_notOwner_throwsForbidden() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));

		assertThatThrownBy(() -> serviceWithAdapter().getDetail(42, "someone-else@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.FORBIDDEN);
	}

	@Test
	void getDetail_notFound_throwsPlaylistNotFound() {
		when(playlistMapper.findById(999)).thenReturn(null);

		assertThatThrownBy(() -> serviceWithAdapter().getDetail(999, "owner@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(PlaylistErrorCode.PLAYLIST_NOT_FOUND);
	}

	@Test
	void getDetail_emptyPlaylist_worksWithoutMusicAdapter() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findMusicIdsInOrder(42)).thenReturn(List.of());

		PlaylistDetailResponse response = serviceWithoutAdapter().getDetail(42, "owner@gmail.com");

		assertThat(response.musicCnt()).isZero();
		assertThat(response.totalDuration()).isZero();
		assertThat(response.musics()).isEmpty();
	}

	@Test
	void getDetail_withTracksButAdapterMissing_throwsUnsupportedOperation() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findMusicIdsInOrder(42)).thenReturn(List.of(1L));

		assertThatThrownBy(() -> serviceWithoutAdapter().getDetail(42, "owner@gmail.com"))
				.isInstanceOf(UnsupportedOperationException.class);
	}

	@Test
	void getDetail_withTracks_returnsMusicsAndTotalDuration() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findMusicIdsInOrder(42)).thenReturn(List.of(1L, 2L));
		when(musicDetailReader.findDetailsByIds(List.of(1L, 2L)))
				.thenReturn(List.of(music(1L, 200), music(2L, 100)));

		PlaylistDetailResponse response = serviceWithAdapter().getDetail(42, "owner@gmail.com");

		assertThat(response.musicCnt()).isEqualTo(2);
		assertThat(response.totalDuration()).isEqualTo(300);
		assertThat(response.musics()).extracting(MusicDetail::id).containsExactly(1L, 2L);
	}

	@Test
	void getDetail_carriesTrackCoordinates_forTheConstellationOverlay() { // FR-010 (S15P21A405-265)
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findMusicIdsInOrder(42)).thenReturn(List.of(1L, 2L));
		when(musicDetailReader.findDetailsByIds(List.of(1L, 2L)))
				.thenReturn(List.of(music(1L, 200), music(2L, 100)));

		PlaylistDetailResponse response = serviceWithAdapter().getDetail(42, "owner@gmail.com");

		// 플리 별자리는 이 좌표로 그린다. 응답에서 location 이 빠지면 오버레이가 통째로 죽는다.
		assertThat(response.musics()).allSatisfy(music -> assertThat(music.location()).isNotNull());
		assertThat(response.musics().get(0).location().pc1()).isEqualTo(0.5);
		assertThat(response.musics().get(0).location().pc16()).isEqualTo(-0.25);
		assertThat(response.musics().get(1).location().pc1()).isEqualTo(1.0);
	}

	@Test
	void getDetail_readsTracksInOneRoundTrip_regardlessOfTrackCount() { // S15P21A405-265 (SC-004)
		List<Long> musicIds = new ArrayList<>();
		List<MusicDetail> musics = new ArrayList<>();
		for (long musicId = 1; musicId <= 30; musicId++) {
			musicIds.add(musicId);
			musics.add(music(musicId, 10));
		}
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findMusicIdsInOrder(42)).thenReturn(musicIds);
		when(musicDetailReader.findDetailsByIds(musicIds)).thenReturn(musics);

		PlaylistDetailResponse response = serviceWithAdapter().getDetail(42, "owner@gmail.com");

		assertThat(response.musicCnt()).isEqualTo(30);
		verify(musicDetailReader, times(1)).findDetailsByIds(anyList());
		verify(musicDetailReader, never()).findDetail(anyLong()); // 곡당 왕복으로 돌아가지 않았는지
	}

	@Test
	void getDetail_keepsStoredTrackOrder_evenWhenBatchReadReturnsShuffled() { // S15P21A405-265 (FR-012)
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findMusicIdsInOrder(42)).thenReturn(List.of(3L, 1L, 2L));
		// IN 은 입력 순서를 보존하지 않는다. 저장된 position 순서는 서비스가 되세운다.
		when(musicDetailReader.findDetailsByIds(List.of(3L, 1L, 2L)))
				.thenReturn(List.of(music(2L, 10), music(3L, 10), music(1L, 10)));

		PlaylistDetailResponse response = serviceWithAdapter().getDetail(42, "owner@gmail.com");

		assertThat(response.musics()).extracting(MusicDetail::id).containsExactly(3L, 1L, 2L);
	}

	@Test
	void getDetail_skipsTracksTheBatchReadCouldNotFind() { // S15P21A405-265 (기존 동작 유지)
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findMusicIdsInOrder(42)).thenReturn(List.of(1L, 999L, 2L));
		when(musicDetailReader.findDetailsByIds(List.of(1L, 999L, 2L)))
				.thenReturn(List.of(music(1L, 200), music(2L, 100)));

		PlaylistDetailResponse response = serviceWithAdapter().getDetail(42, "owner@gmail.com");

		assertThat(response.musics()).extracting(MusicDetail::id).containsExactly(1L, 2L);
		assertThat(response.musicCnt()).isEqualTo(2);
	}

	// ---- create (§4.3) ----

	@Test
	void create_duplicateName_throwsPlaylistNameDuplicated() {
		when(playlistMapper.existsByOwnerEmailAndName("me@gmail.com", "출근길")).thenReturn(true);

		assertThatThrownBy(() -> serviceWithAdapter().create("me@gmail.com", "출근길", List.of()))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(PlaylistErrorCode.PLAYLIST_NAME_DUPLICATED);

		verify(playlistMapper, never()).insertPlaylist(any());
	}

	@Test
	void create_emptyMusicList_worksWithoutAdapter() {
		when(playlistMapper.existsByOwnerEmailAndName("me@gmail.com", "출근길")).thenReturn(false);

		PlaylistCreateResponse response = serviceWithoutAdapter().create("me@gmail.com", "출근길", List.of());

		assertThat(response.playlistName()).isEqualTo("출근길");
		assertThat(response.musicCnt()).isZero();
		verify(playlistMapper).insertPlaylist(any());
		verify(playlistMapper, never()).insertPlaylistMusicBatch(anyLong(), any());
	}

	@Test
	void create_musicNotFound_throwsMusicNotFound() {
		when(playlistMapper.existsByOwnerEmailAndName("me@gmail.com", "출근길")).thenReturn(false);
		when(musicDetailReader.findDetail(999L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> serviceWithAdapter().create("me@gmail.com", "출근길", List.of(999L)))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(MusicErrorCode.MUSIC_NOT_FOUND);

		verify(playlistMapper, never()).insertPlaylist(any());
	}

	@Test
	void create_withValidMusicIds_insertsPlaylistAndTracks() {
		when(playlistMapper.existsByOwnerEmailAndName("me@gmail.com", "출근길")).thenReturn(false);
		when(musicDetailReader.findDetail(1L)).thenReturn(Optional.of(music(1L, 200)));
		when(musicDetailReader.findDetail(2L)).thenReturn(Optional.of(music(2L, 100)));

		PlaylistCreateResponse response = serviceWithAdapter().create("me@gmail.com", "출근길", List.of(1L, 2L));

		assertThat(response.musicCnt()).isEqualTo(2);
		ArgumentCaptor<List<PlaylistMusicInsertItem>> captor = ArgumentCaptor.forClass(List.class);
		verify(playlistMapper).insertPlaylistMusicBatch(anyLong(), captor.capture());
		assertThat(captor.getValue()).extracting(PlaylistMusicInsertItem::position).containsExactly(0, 1);
	}

	// ---- insertMusic (§4.4) ----

	@Test
	void insertMusic_notOwner_throwsForbidden() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));

		assertThatThrownBy(() -> serviceWithAdapter().insertMusic(42, List.of(1L), "someone-else@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.FORBIDDEN);
	}

	@Test
	void insertMusic_skipsAlreadyPresentAndAppendsNewAtEnd() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findExistingMusicIds(eq(42L), eq(List.of(1L, 2L)))).thenReturn(List.of(1L));
		when(musicDetailReader.findDetail(2L)).thenReturn(Optional.of(music(2L, 100)));
		when(playlistMapper.countMusic(42)).thenReturn(5).thenReturn(6);

		PlaylistMusicInsertResponse response = serviceWithAdapter().insertMusic(42, List.of(1L, 2L), "owner@gmail.com");

		assertThat(response.insertedCnt()).isEqualTo(1);
		assertThat(response.skippedCnt()).isEqualTo(1);
		assertThat(response.skippedMusicIds()).containsExactly(1L);
		assertThat(response.musicCnt()).isEqualTo(6);

		ArgumentCaptor<List<PlaylistMusicInsertItem>> captor = ArgumentCaptor.forClass(List.class);
		verify(playlistMapper).insertPlaylistMusicBatch(eq(42L), captor.capture());
		assertThat(captor.getValue()).containsExactly(new PlaylistMusicInsertItem(2L, 5));
	}

	@Test
	void insertMusic_allAlreadyPresent_doesNotRequireAdapter() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findExistingMusicIds(eq(42L), eq(List.of(1L)))).thenReturn(List.of(1L));
		when(playlistMapper.countMusic(42)).thenReturn(3);

		PlaylistMusicInsertResponse response = serviceWithoutAdapter().insertMusic(42, List.of(1L), "owner@gmail.com");

		assertThat(response.insertedCnt()).isZero();
		assertThat(response.skippedCnt()).isEqualTo(1);
		verify(playlistMapper, never()).insertPlaylistMusicBatch(anyLong(), any());
	}

	// ---- deleteMusic (§4.5) ----

	@Test
	void deleteMusic_notOwner_throwsForbidden() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));

		assertThatThrownBy(() -> serviceWithAdapter().deleteMusic(42, List.of(1L), "someone-else@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.FORBIDDEN);
	}

	@Test
	void deleteMusic_returnsDeletedAndRemainingCount() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.deletePlaylistMusic(eq(42L), eq(List.of(1L, 10877L)))).thenReturn(1);
		when(playlistMapper.countMusic(42)).thenReturn(19);

		PlaylistMusicDeleteResponse response =
				serviceWithAdapter().deleteMusic(42, List.of(1L, 10877L), "owner@gmail.com");

		assertThat(response.deletedCnt()).isEqualTo(1);
		assertThat(response.musicCnt()).isEqualTo(19);
	}

	// ---- reorderMusic ----

	@Test
	void reorderMusic_setMismatch_throwsInvalidInput() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findMusicIdsInOrder(42)).thenReturn(List.of(1L, 2L));

		assertThatThrownBy(() -> serviceWithAdapter().reorderMusic(42, List.of(1L, 3L), "owner@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);

		verify(playlistMapper, never()).deleteAllPlaylistMusic(anyLong());
	}

	@Test
	void reorderMusic_sameSetDifferentOrder_replacesRows() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.findMusicIdsInOrder(42)).thenReturn(List.of(1L, 2L));

		PlaylistMusicReorderResponse response =
				serviceWithAdapter().reorderMusic(42, List.of(2L, 1L), "owner@gmail.com");

		assertThat(response.musicCnt()).isEqualTo(2);
		verify(playlistMapper).deleteAllPlaylistMusic(42);
		ArgumentCaptor<List<PlaylistMusicInsertItem>> captor = ArgumentCaptor.forClass(List.class);
		verify(playlistMapper).insertPlaylistMusicBatch(eq(42L), captor.capture());
		assertThat(captor.getValue()).containsExactly(
				new PlaylistMusicInsertItem(2L, 0), new PlaylistMusicInsertItem(1L, 1));
	}

	// ---- update (§4.6) ----

	@Test
	void update_notOwner_throwsForbidden() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));

		assertThatThrownBy(() -> serviceWithAdapter().update(42, "새 이름", "someone-else@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.FORBIDDEN);
	}

	@Test
	void update_duplicateName_throwsPlaylistNameDuplicated() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.existsByOwnerEmailAndName("owner@gmail.com", "출근길")).thenReturn(true);

		assertThatThrownBy(() -> serviceWithAdapter().update(42, "출근길", "owner@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(PlaylistErrorCode.PLAYLIST_NAME_DUPLICATED);

		verify(playlistMapper, never()).updateName(anyLong(), any());
	}

	@Test
	void update_sameNameAsBefore_skipsDuplicateCheck() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));
		when(playlistMapper.countMusic(42)).thenReturn(4);

		PlaylistUpdateResponse response = serviceWithAdapter().update(42, "드라이브", "owner@gmail.com");

		assertThat(response.playlistName()).isEqualTo("드라이브");
		verify(playlistMapper, never()).existsByOwnerEmailAndName(any(), any());
		verify(playlistMapper).updateName(42, "드라이브");
	}

	// ---- delete (§4.7) ----

	@Test
	void delete_notOwner_throwsForbidden() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));

		assertThatThrownBy(() -> serviceWithAdapter().delete(42, "someone-else@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.FORBIDDEN);

		verify(playlistMapper, never()).deleteById(anyLong());
	}

	@Test
	void delete_owner_deletesPlaylist() {
		when(playlistMapper.findById(42)).thenReturn(playlist(42, "owner@gmail.com", "드라이브"));

		serviceWithAdapter().delete(42, "owner@gmail.com");

		verify(playlistMapper, times(1)).deleteById(42);
	}
}
