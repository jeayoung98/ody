package com.ssafy.backend.playlist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** /playlist/update 요청 (정본 §4.6). */
public record PlaylistUpdateRequest(
		@NotNull Long playlistId,
		@NotBlank String playlistName) {
}
