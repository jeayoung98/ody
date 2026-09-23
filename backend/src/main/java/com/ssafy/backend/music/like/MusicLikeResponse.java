package com.ssafy.backend.music.like;

import java.time.OffsetDateTime;

public record MusicLikeResponse(long musicId, boolean liked, OffsetDateTime likedAt) {
}
