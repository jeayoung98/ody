package com.ssafy.backend.playlist.dto;

import java.util.List;

/** /playlist/search 응답 (정본 §4.1). 페이지네이션 없이 content만 감싼다(정본 예시 기준). */
public record PlaylistSearchResponse(List<PlaylistSummary> content) {
}
