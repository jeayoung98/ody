package com.ssafy.backend.playlist.dto;

/** /playlist/update 응답 (정본 §4.6). */
public record PlaylistUpdateResponse(long playlistId, String playlistName, int musicCnt) {
}
