package com.ssafy.backend.playlist.dto;

import java.util.List;

/**
 * /playlist/liked 응답 (S15P21A405-447). 목록 API 는 content 배열로 감싼다 —
 * /playlist/search(PlaylistSearchResponse)와 같은 형태다.
 */
public record LikedPlaylistSearchResponse(List<LikedPlaylistSummary> content) {
}
