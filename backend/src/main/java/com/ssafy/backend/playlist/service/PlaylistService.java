package com.ssafy.backend.playlist.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.common.PlaylistErrorCode;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.playlist.dto.PlaylistCreateResponse;
import com.ssafy.backend.playlist.dto.PlaylistDetailResponse;
import com.ssafy.backend.playlist.dto.PlaylistLikeRequest;
import com.ssafy.backend.playlist.dto.PlaylistLikeResponse;
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

import lombok.extern.slf4j.Slf4j;

@Slf4j
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

		List<PlaylistSummary> summaries = playlistMapper.findSummariesByOwnerEmail(targetEmail).stream()
				.map(row -> new PlaylistSummary(row.getId(), row.getName(), row.getMusicCnt(), row.getCreatedAt()))
				.toList();
		log.info("[Playlist] 목록 조회 완료 targetEmail={} count={}", targetEmail, summaries.size());
		return summaries;
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

		log.info("[Playlist] 상세 조회 완료 playlistId={} musicCnt={}", playlistId, musics.size());
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

		log.info("[Playlist] 생성 완료 playlistId={} ownerEmail={} musicCnt={}",
				playlist.getId(), ownerEmail, musicIdList.size());
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
		log.info("[Playlist] 곡 추가 완료 playlistId={} added={} alreadyIn={}",
				playlistId, toInsert.size(), alreadyInSet.size());
		return new PlaylistMusicInsertResponse(playlistId, toInsert.size(), alreadyInSet.size(), alreadyIn, musicCnt);
	}

	/**
	 * 플레이리스트에서 곡 삭제 (정본 §4.5). 없는 곡 ID는 무시(멱등), 실제 삭제 개수만 반환.
	 */
	public PlaylistMusicDeleteResponse deleteMusic(long playlistId, List<Long> musicIdList, String requesterEmail) {
		requireOwnedPlaylist(playlistId, requesterEmail);

		int deletedCnt = playlistMapper.deletePlaylistMusic(playlistId, musicIdList);
		int musicCnt = playlistMapper.countMusic(playlistId);

		log.info("[Playlist] 곡 삭제 완료 playlistId={} deleted={}", playlistId, deletedCnt);
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

		log.info("[Playlist] 순서 변경 완료 playlistId={} musicCnt={}", playlistId, musicIdList.size());
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

		log.info("[Playlist] 이름 변경 완료 playlistId={}", playlistId);
		return new PlaylistUpdateResponse(playlistId, newName, musicCnt);
	}

	/**
	 * 플레이리스트 삭제 (정본 §4.7). 곡 매핑은 FK ON DELETE CASCADE로 함께 삭제(곡 자체는 미삭제).
	 */
	public void delete(long playlistId, String requesterEmail) {
		requireOwnedPlaylist(playlistId, requesterEmail);
		playlistMapper.deleteById(playlistId);
		log.info("[Playlist] 삭제 완료 playlistId={}", playlistId);
	}

	/**
	 * 플레이리스트 좋아요 변경 (S15P21A405-442). 남의 플레이리스트에도 누를 수 있으므로 소유자 검사는 없다.
	 *
	 * liked 는 토글이 아니라 목표 상태다. 이미 그 상태면 like_cnt 를 건드리지 않고 현재 값을 그대로 돌려준다
	 * — 연타나 재전송으로 숫자가 부풀지 않게 하려는 것이고, 그래서 이 API 는 몇 번 불러도 결과가 같다.
	 *
	 * like_cnt 는 playlist_like 기록의 집계 사본이라 기록이 실제로 바뀐 경우에만 함께 바꾼다.
	 * 둘이 어긋나면 화면 숫자가 틀리므로 한 트랜잭션으로 묶는다.
	 */
	@Transactional
	public PlaylistLikeResponse changeLike(PlaylistLikeRequest request, String requesterEmail) {
		if (request == null || request.playlistId() == null || request.liked() == null) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}

		long playlistId = request.playlistId();
		boolean liked = request.liked();

		if (playlistMapper.findById(playlistId) == null) {
			throw new CustomException(PlaylistErrorCode.PLAYLIST_NOT_FOUND);
		}

		// 동시에 두 번 눌려도 기록 테이블의 PK 와 ON CONFLICT 가 한 번만 통과시킨다.
		// 그 "실제로 바뀌었는지"(changed)가 like_cnt 를 움직일지 판단하는 유일한 근거다.
		int changed = liked
				? playlistMapper.insertLike(playlistId, requesterEmail)
				: playlistMapper.deleteLike(playlistId, requesterEmail);

		if (changed > 0) {
			playlistMapper.addLikeCnt(playlistId, liked ? 1 : -1);
		}

		int likeCnt = playlistMapper.findLikeCnt(playlistId);
		log.info("[Playlist] 좋아요 변경 완료 playlistId={} liked={} changed={} likeCnt={}",
				playlistId, liked, changed > 0, likeCnt);
		return new PlaylistLikeResponse(playlistId, liked, likeCnt);
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

	/**
	 * 곡 상세를 <b>한 번에</b> 읽어 저장된 순서({@code position})로 재조립한다 (S15P21A405-265).
	 *
	 * <p>이전에는 곡당 {@code findDetail} 1회라 30곡이면 DB 30왕복이었다. 일괄 조회는 순서를
	 * 보장하지 않으므로 여기서 id 키로 되세운다. 없는 곡은 그대로 빠진다(기존 동작 유지).
	 */
	private List<MusicDetail> loadMusicDetails(List<Long> musicIds) {
		MusicDetailReader reader = musicDetailReader.orElseThrow(
				() -> new UnsupportedOperationException("playlist/detail: BE4 조회 어댑터 대기 중 (B-D)"));
		Map<Long, MusicDetail> byId = new HashMap<>();
		for (MusicDetail music : reader.findDetailsByIds(musicIds)) {
			byId.put(music.id(), music);
		}
		List<MusicDetail> musics = new ArrayList<>(musicIds.size());
		for (Long musicId : musicIds) {
			MusicDetail music = byId.get(musicId);
			if (music != null) {
				musics.add(music);
			}
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
