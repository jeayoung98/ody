package com.ssafy.backend.artwork.dto;

/**
 * 그린 별자리 결과의 한 점 (S15P21A405-598). {@link ArtworkPoint} 에 곡 이름을 더했다 — 화면이 결과 곡 목록을
 * 바로 그릴 수 있게 한다. {@code x}·{@code y} 는 배치 API 와 같은 값(-1~1, y 위).
 *
 * @param artist 없으면 null
 */
public record DrawTrack(long musicId, String title, String artist, double x, double y) {
}
