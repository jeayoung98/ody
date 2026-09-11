package com.ssafy.backend.playlist.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.common.PlaylistErrorCode;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
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
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.mapper.UserMapper;

@Service
public class PlaylistService {

	private final PlaylistMapper playlistMapper;
	private final UserMapper userMapper;
	private final Optional<MusicDetailReader> musicDetailReader;

	// ponytail: music 조회 어댑터(BE4)가 아직 없어 Optional 주입. MusicService와 동일한 패턴.
	public PlaylistService(
			PlaylistMapper playlistMapper, UserMapper userMapper, Optional<MusicDetailReader> musicDetailReader) {
		this.playlistMapper = playlistMapper;
		this.userMapper = userMapper;
		this.musicDetailReader = musicDetailReader;
	}

	/**
	 * 플레이리스트 목록 조회 (정본 §4.1). 본인 목록도 이 API(email에 본인 email).
	 * 대상 사용자가 비공개면 본인이 아닌 한 USER_PRIVATE.
	 */
	public List<PlaylistSummary> search(String targetEmail, String requesterEmail) {
		UserProfileRow user = userMapper.findProfileByEmail(targetEmail);
		if (user == null) {
			throw new CustomException(UserErrorCode.USER_NOT_FOUND);
		}
		if (!user.isPublic() && !targetEmail.equals(requesterEmail)) {
			throw new CustomException(UserErrorCode.USER_PRIVATE);
		}

		return playlistMapper.findSummariesByOwnerEmail(targetEmail).stream()
				.map(row -> new PlaylistSummary(row.getId(), row.getName(), row.getMusicCnt(), row.getCreatedAt()))
				.toList();
	}

	/**
	 * 플레이리스트 상세 조회 (정본 §4.2). 소유자만 접근 가능(§0.7).
	 * 곡 정보 조회는 music 어댑터 필요 — 빈 플레이리스트는 어댑터 없어도 동작한다.
	 */
	public PlaylistDetailResponse getDetail(long playlistId, String requesterEmail) {
		PlaylistRow playlist = requireOwnedPlaylist(playlistId, requesterEmail);
		List<Long> musicIds = playlistMapper.findMusicIdsInOrder(playlistId);

		List<MusicDetail> musics = musicIds.isEmpty() ? List.of() : loadMusicDetails(musicIds);
		int totalDuration = musics.stream().mapToInt(m -> m.duration() == null ? 0 : m.duration()).sum();

		return new PlaylistDetailResponse(playlist.getId(), playlist.getName(), musics.size(), totalDuration, musics);
	}

	/**
	 * 플레이리스트 생성 (정본 §4.3). 소유자는 토큰 주체, musicIdList는 빈 배열 허용.
	 */
	public PlaylistCreateResponse create(String ownerEmail, String playlistName, List<Long> musicIdList) {
		if (playlistMapper.existsByOwnerEmailAndName(ownerEmail, playlistName)) {
			throw new CustomException(PlaylistErrorCode.PLAYLIST_NAME_DUPLICATED);
		}
		if (!musicIdList.isEmpty()) {
			requireAllMusicExist(musicIdList);
		}

		PlaylistRow playlist = new PlaylistRow();
		playlist.setOwnerEmail(ownerEmail);
		playlist.setName(playlistName);
		playlistMapper.insertPlaylist(playlist);

		if (!musicIdList.isEmpty()) {
			playlistMapper.insertPlaylistMusicBatch(playlist.getId(), toInsertItems(musicIdList, 0));
		}

		return new PlaylistCreateResponse(playlist.getId(), playlistName, musicIdList.size());
	}

	/**
	 * 기존 플레이리스트에 곡 추가 (정본 §4.4). 이미 담긴 곡은 에러 대신 skipped로 부분 성공 처리.
	 */
	public PlaylistMusicInsertResponse insertMusic(long playlistId, List<Long> musicIdList, String requesterEmail) {
		requireOwnedPlaylist(playlistId, requesterEmail);

		List<Long> alreadyIn = playlistMapper.findExistingMusicIds(playlistId, musicIdList);
		Set<Long> alreadyInSet = new HashSet<>(alreadyIn);
		List<Long> toInsert = musicIdList.stream().distinct().filter(id -> !alreadyInSet.contains(id)).toList();

		if (!toInsert.isEmpty()) {
			requireAllMusicExist(toInsert);
			int startPosition = playlistMapper.countMusic(playlistId);
			playlistMapper.insertPlaylistMusicBatch(playlistId, toInsertItems(toInsert, startPosition));
		}

		int musicCnt = playlistMapper.countMusic(playlistId);
		return new PlaylistMusicInsertResponse(playlistId, toInsert.size(), alreadyInSet.size(), alreadyIn, musicCnt);
	}

	/**
	 * 플레이리스트에서 곡 삭제 (정본 §4.5). 없는 곡 ID는 무시(멱등), 실제 삭제 개수만 반환.
	 */
	public PlaylistMusicDeleteResponse deleteMusic(long playlistId, List<Long> musicIdList, String requesterEmail) {
		requireOwnedPlaylist(playlistId, requesterEmail);

		int deletedCnt = playlistMapper.deletePlaylistMusic(playlistId, musicIdList);
		int musicCnt = playlistMapper.countMusic(playlistId);

		return new PlaylistMusicDeleteResponse(playlistId, deletedCnt, musicCnt);
	}

	/**
	 * 플레이리스트 곡 순서 변경 (S15P21A405-66, 정본 §4에는 없는 신규 엔드포인트).
	 * musicIdList는 현재 담긴 곡과 정확히 같은 집합이어야 한다(추가/삭제는 여기서 하지 않음).
	 */
	public PlaylistMusicReorderResponse reorderMusic(long playlistId, List<Long> musicIdList, String requesterEmail) {
		requireOwnedPlaylist(playlistId, requesterEmail);

		Set<Long> current = new HashSet<>(playlistMapper.findMusicIdsInOrder(playlistId));
		Set<Long> requested = new HashSet<>(musicIdList);
		if (!current.equals(requested) || current.size() != musicIdList.size()) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}

		playlistMapper.deleteAllPlaylistMusic(playlistId);
		playlistMapper.insertPlaylistMusicBatch(playlistId, toInsertItems(musicIdList, 0));

		return new PlaylistMusicReorderResponse(playlistId, musicIdList.size());
	}

	/**
	 * 플레이리스트 이름 변경 (정본 §4.6).
	 */
	public PlaylistUpdateResponse update(long playlistId, String newName, String requesterEmail) {
		PlaylistRow playlist = requireOwnedPlaylist(playlistId, requesterEmail);

		if (!playlist.getName().equals(newName)
				&& playlistMapper.existsByOwnerEmailAndName(playlist.getOwnerEmail(), newName)) {
			throw new CustomException(PlaylistErrorCode.PLAYLIST_NAME_DUPLICATED);
		}

		playlistMapper.updateName(playlistId, newName);
		int musicCnt = playlistMapper.countMusic(playlistId);

		return new PlaylistUpdateResponse(playlistId, newName, musicCnt);
	}

	/**
	 * 플레이리스트 삭제 (정본 §4.7). 곡 매핑은 FK ON DELETE CASCADE로 함께 삭제(곡 자체는 미삭제).
	 */
	public void delete(long playlistId, String requesterEmail) {
		requireOwnedPlaylist(playlistId, requesterEmail);
		playlistMapper.deleteById(playlistId);
	}

	private PlaylistRow requireOwnedPlaylist(long playlistId, String requesterEmail) {
		PlaylistRow playlist = playlistMapper.findById(playlistId);
		if (playlist == null) {
			throw new CustomException(PlaylistErrorCode.PLAYLIST_NOT_FOUND);
		}
		if (!playlist.getOwnerEmail().equals(requesterEmail)) {
			throw new CustomException(GlobalErrorCode.FORBIDDEN);
		}
		return playlist;
	}

	private void requireAllMusicExist(List<Long> musicIdList) {
		MusicDetailReader reader = musicDetailReader.orElseThrow(
				() -> new UnsupportedOperationException("playlist/music: BE4 조회 어댑터 대기 중 (B-D)"));
		for (Long musicId : musicIdList) {
			reader.findDetail(musicId)
					.orElseThrow(() -> new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));
		}
	}

	private List<MusicDetail> loadMusicDetails(List<Long> musicIds) {
		MusicDetailReader reader = musicDetailReader.orElseThrow(
				() -> new UnsupportedOperationException("playlist/detail: BE4 조회 어댑터 대기 중 (B-D)"));
		List<MusicDetail> musics = new ArrayList<>(musicIds.size());
		for (Long musicId : musicIds) {
			reader.findDetail(musicId).ifPresent(musics::add);
		}
		return musics;
	}

	private List<PlaylistMusicInsertItem> toInsertItems(List<Long> musicIds, int startPosition) {
		List<PlaylistMusicInsertItem> items = new ArrayList<>(musicIds.size());
		for (int i = 0; i < musicIds.size(); i++) {
			items.add(new PlaylistMusicInsertItem(musicIds.get(i), startPosition + i));
		}
		return items;
	}
}
