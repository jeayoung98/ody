package com.ssafy.backend.music.dto;

import java.util.List;

/**
 * 주변 탐색 응답 (정본 §3.5).
 *
 * <p>{@code neighbors} 원소는 곡 상세(§3.2)의 것과 <b>같은 타입</b>이다({@link NeighborTrack}) —
 * 두 진입점이 같은 곡에 같은 목록을 줘야 하므로 새로 만들지 않는다(005 FR-023, SC-006).
 *
 * @param center         기준점. 좌표 기준이면 곡 필드가 비어 있다
 * @param neighbors      선정 규칙을 통과한 <b>최대 10곡</b>. 거리 오름차순, 동률 시 id 오름차순.
 *                       규칙을 통과한 곡이 없으면 빈 목록이고 그것도 성공이다(FR-009)
 * @param lowSimilarity  마지막 이웃 거리가 {@code tauFar} 를 넘었다는 표시. <b>오류가 아니다.</b>
 *                       이웃이 0곡이어도 {@code true}. 운영 실측 발동률 약 9% 라 드문 경우가 아니다(FR-021)
 */
public record NearbyResponse(
		NearbyCenter center,
		List<NeighborTrack> neighbors,
		boolean lowSimilarity) {
}
