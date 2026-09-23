package com.ssafy.backend.music.like;

import java.time.OffsetDateTime;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MusicLikeRow {
    private long musicId;
    private OffsetDateTime likedAt;
}
