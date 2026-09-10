package com.ssafy.backend.playlist.dto;

/** /playlist/music/delete 응답 (정본 §4.5). 없는 곡 ID 섞여도 무시(멱등), 실제 삭제 개수만 반환. */
public record PlaylistMusicDeleteResponse(long playlistId, int deletedCnt, int musicCnt) {
}
