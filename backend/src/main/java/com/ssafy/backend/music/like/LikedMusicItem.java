package com.ssafy.backend.music.like;

import java.time.OffsetDateTime;

public record LikedMusicItem(
        long musicId,
        String title,
        String artist,
        Integer duration,
        String youtubeUrl,
        String videoId,
        OffsetDateTime likedAt) {
}
