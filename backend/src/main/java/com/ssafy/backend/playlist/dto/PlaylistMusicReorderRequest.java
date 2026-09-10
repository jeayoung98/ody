package com.ssafy.backend.playlist.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/**
 * /playlist/music/reorder 요청 (S15P21A405-66, 정본 §4에는 없는 신규 엔드포인트).
 * musicIdList는 이번 곡 목록 전체(현재 담긴 곡과 정확히 같은 집합)를 새 순서대로 나열한 것이어야 한다.
 */
public record PlaylistMusicReorderRequest(
		@NotNull Long playlistId,
		@NotEmpty List<Long> musicIdList) {
}
