package com.ssafy.backend.music.dto;

import java.util.List;

/**
 * 별자리 배치 응답 (BACKEND-NOTES A-9).
 *
 * @param points 요청 {@code musicIds} 와 <b>같은 개수·같은 나열 순서</b>. 누락은 없다 —
 *               곡을 하나라도 못 채우면 404 다(부분 배치를 성공으로 내지 않는다)
 */
public record ConstellationLayoutResponse(List<ConstellationPoint> points) {
}
