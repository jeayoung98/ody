package com.ssafy.backend.artwork.dto;

/**
 * 작품 별자리의 한 점과 그 곡 이름 (S15P21A405-616). 리더보드 카드·상세가 좌표와 곡 목록을 한 원소로 받는다 —
 * 좌표 배열과 곡 배열을 따로 주면 곡이 지워졌을 때 순번이 어긋난다.
 *
 * <p>ponytail: 598 {@code DrawTrack} 과 같은 모양이다. 필드가 갈라지기 시작하면 그때 하나로 합친다.
 *
 * @param title  곡이 지워졌거나 곡 조회 어댑터가 없으면 null
 * @param artist 없으면 null
 */
public record ArtworkTrack(long musicId, String title, String artist, double x, double y) {
}
