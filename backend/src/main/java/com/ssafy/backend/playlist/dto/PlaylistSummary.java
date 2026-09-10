package com.ssafy.backend.playlist.dto;

import java.time.OffsetDateTime;

/** /playlist/search 응답 원소 (정본 §4.1). */
public record PlaylistSummary(long playlistId, String playlistName, int musicCnt, OffsetDateTime createdAt) {
}
