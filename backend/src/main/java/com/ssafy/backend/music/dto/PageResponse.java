package com.ssafy.backend.music.dto;

import java.util.List;

/**
 * 목록 응답 공통 래퍼 (정본 §0.3). size는 참고값(서버 고정 크기).
 * user/search·playlist 등 다른 목록 API도 재사용 가능.
 */
public record PageResponse<T>(
		List<T> content,
		int page,
		int size,
		long totalElements,
		int totalPages,
		boolean hasNext) {
}
