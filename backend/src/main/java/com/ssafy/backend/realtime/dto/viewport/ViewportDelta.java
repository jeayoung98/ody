package com.ssafy.backend.realtime.dto.viewport;

/**
 * 화면 사용자 한 명의 변경 정보.
 * LEAVE는 requestSeq와 email만 사용한다.
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
