package com.ssafy.backend.artwork.dto;

/**
 * 작품 제출 응답.
 *
 * <p>{@code status} 는 언제나 {@code PENDING} 이다 — 제출은 평가를 기다리지 않는다.
 * 점수를 보려면 프론트가 상세를 다시 조회해야 한다.
 */
public record ArtworkSubmitResponse(long artworkId, String status) {
}
