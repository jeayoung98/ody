package com.ssafy.backend.playlist.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/** /playlist/music/insert 요청 (정본 §4.4). */
public record PlaylistMusicInsertRequest(
		@NotNull Long playlistId,
		@NotEmpty List<Long> musicIdList) {
}
