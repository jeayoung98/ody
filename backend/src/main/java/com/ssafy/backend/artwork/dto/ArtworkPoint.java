package com.ssafy.backend.artwork.dto;

/**
 * 작품 위의 한 점. 필드명·의미가 {@code music.dto.ConstellationPoint} 와 같다 —
 * 프론트가 별자리 뷰를 그대로 재사용할 수 있게 하려는 것이다.
 */
public record ArtworkPoint(long musicId, double x, double y) {
}
