package com.ssafy.backend.realtime.dto.viewport;

/**
 * 화면 사용자 한 명의 변경 정보.
 * LEAVE는 requestSeq와 email만 사용한다.
 * x·y 는 현재 레이어 표시 2축의 원시 PC 좌표다 — 스냅샷 groups[].x/y, 셀 인원수 cells[].x/y 와 같은 좌표계.
 */
public record ViewportDelta(
		long requestSeq,
		String email,
		String nickname,
		String imageUrl,
		Long musicId,
		Double x,
		Double y,
		Integer riderCount) {
}
