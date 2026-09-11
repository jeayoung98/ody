package com.ssafy.backend.playlist.dto;

/** playlist_music 배치 insert용 (position 계산은 서비스가 미리 끝낸다). */
public record PlaylistMusicInsertItem(long musicId, int position) {
}
