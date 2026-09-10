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
}
