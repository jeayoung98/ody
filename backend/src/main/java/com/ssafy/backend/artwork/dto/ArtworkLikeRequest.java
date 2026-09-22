package com.ssafy.backend.artwork.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 작품 좋아요 변경 요청. {@code liked} 는 토글이 아니라 <b>목표 상태</b>다 —
 * 같은 요청을 여러 번 보내도 결과가 같다 ({@code PlaylistLikeRequest} 와 같은 규칙).
 */
public record ArtworkLikeRequest(@NotNull @Min(1) Long artworkId, @NotNull Boolean liked) {
}
