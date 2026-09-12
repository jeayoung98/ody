package com.ssafy.backend.music.dto;

/**
 * 별자리 배치 위의 한 점 (PATH-01, BACKEND-NOTES A-9).
 *
 * <p>프론트 {@code types/constellation.ts} 의 {@code ConstellationPoint} 와 필드명·의미가 같다.
 *
 * @param musicId 요청한 {@code music.id} 그대로
 * @param x -1 ~ 1 정규화 좌표
 * @param y -1 ~ 1 정규화 좌표. 위가 양수
 */
public record ConstellationPoint(long musicId, double x, double y) {
}
