package com.ssafy.backend.playlist.dto;

/** /playlist/create 응답 (정본 §4.3, 201). */
public record PlaylistCreateResponse(long playlistId, String playlistName, int musicCnt) {
}
