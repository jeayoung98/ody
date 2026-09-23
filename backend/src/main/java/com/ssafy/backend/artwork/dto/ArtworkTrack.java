package com.ssafy.backend.artwork.dto;

/**
 * 별자리의 한 점과 그 곡 이름 (S15P21A405-616). 작품 리더보드 카드·상세, 그린 별자리 매칭 결과(598 {@code /draw})가
 * 같이 쓴다 — 좌표 배열과 곡 배열을 따로 주면 곡이 지워졌을 때 순번이 어긋난다.
 * {@code x}·{@code y} 는 배치 API 와 같은 값(-1~1, y 위).
 *
 * @param title  곡이 지워졌거나 곡 조회 어댑터가 없으면 null
 * @param artist 없으면 null
 */
public record ArtworkTrack(long musicId, String title, String artist, double x, double y) {
}
