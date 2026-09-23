package com.ssafy.backend.music.like;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** liked는 토글이 아니라 원하는 최종 상태다. */
public record MusicLikeRequest(
        @NotNull @Min(1) Long musicId,
        @NotNull Boolean liked) {
}
