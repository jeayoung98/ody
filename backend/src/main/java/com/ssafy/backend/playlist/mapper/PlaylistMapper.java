package com.ssafy.backend.playlist.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.playlist.dto.PlaylistMusicInsertItem;
import com.ssafy.backend.playlist.dto.PlaylistRow;
import com.ssafy.backend.playlist.dto.PlaylistSummaryRow;

public interface PlaylistMapper {

	/** insert 후 playlist.id를 파라미터 객체에 채워 돌려준다(useGeneratedKeys). */
	void insertPlaylist(PlaylistRow playlist);

	PlaylistRow findById(@Param("playlistId") long playlistId);

	boolean existsByOwnerEmailAndName(@Param("ownerEmail") String ownerEmail, @Param("name") String name);

	List<PlaylistSummaryRow> findSummariesByOwnerEmail(@Param("ownerEmail") String ownerEmail);

	void updateName(@Param("playlistId") long playlistId, @Param("name") String name);

	void deleteById(@Param("playlistId") long playlistId);

	int countMusic(@Param("playlistId") long playlistId);

	/** position 오름차순. */
	List<Long> findMusicIdsInOrder(@Param("playlistId") long playlistId);

	/** musicIdList 중 이미 담겨 있는 것만 반환(§4.4 skipped 계산용). */
	List<Long> findExistingMusicIds(@Param("playlistId") long playlistId, @Param("musicIdList") List<Long> musicIdList);

	void insertPlaylistMusicBatch(@Param("playlistId") long playlistId, @Param("items") List<PlaylistMusicInsertItem> items);

	int deletePlaylistMusic(@Param("playlistId") long playlistId, @Param("musicIdList") List<Long> musicIdList);

	void deleteAllPlaylistMusic(@Param("playlistId") long playlistId);

	// 좋아요 (S15P21A405-442)

	/** 이미 눌러둔 좋아요면 아무것도 하지 않는다(ON CONFLICT DO NOTHING). 실제로 넣었으면 1. */
	int insertLike(@Param("playlistId") long playlistId, @Param("email") String email);

	/** 누른 적 없으면 0. 실제로 지웠으면 1. */
	int deleteLike(@Param("playlistId") long playlistId, @Param("email") String email);

	/** like_cnt 를 delta 만큼 더한다. 0 밑으로는 내려가지 않는다. */
	void addLikeCnt(@Param("playlistId") long playlistId, @Param("delta") int delta);

	int findLikeCnt(@Param("playlistId") long playlistId);

	boolean existsLike(@Param("playlistId") long playlistId, @Param("email") String email);
}
