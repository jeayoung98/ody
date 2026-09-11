package com.ssafy.backend.playlist.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/** /playlist/music/delete 요청 (정본 §4.5). */
public record PlaylistMusicDeleteRequest(
		@NotNull Long playlistId,
		@NotEmpty List<Long> musicIdList) {
}
