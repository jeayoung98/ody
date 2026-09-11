package com.ssafy.backend.playlist.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** /playlist/create 요청 (정본 §4.3). musicIdList는 빈 배열 허용. */
public record PlaylistCreateRequest(
		@NotBlank String playlistName,
		@NotNull List<Long> musicIdList) {
}
