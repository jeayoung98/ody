package com.ssafy.backend.music.like;

import java.time.OffsetDateTime;

import com.ssafy.backend.music.dto.Location;

/**
 * @param location 16차 좌표. 좋아요 목록을 재생할 때 FE 가 별자리를 같이 띄우는데, 그 입력이 곡 좌표다.
 *                 플레이리스트 상세는 {@code MusicDetail} 로 좌표를 이미 주고 있어 두 화면이 같은 재생 경로를
 *                 쓰려면 여기도 있어야 한다 [S15P21A405-650]. 좌표가 없는 곡은 {@code null} 이고 목록에서 빠지지 않는다
 * @param playCnt  별자리의 점 크기(가중치)로 쓰인다
 */
public record LikedMusicItem(
        long musicId,
        String title,
        String artist,
        Integer duration,
        String youtubeUrl,
        String videoId,
        Location location,
        Integer playCnt,
        OffsetDateTime likedAt) {
}
