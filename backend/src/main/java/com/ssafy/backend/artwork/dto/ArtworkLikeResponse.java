package com.ssafy.backend.artwork.dto;

/** 작품 좋아요 변경 응답. {@code likeCnt} 는 변경 후 값이다. */
public record ArtworkLikeResponse(long artworkId, boolean liked, int likeCnt) {
}
