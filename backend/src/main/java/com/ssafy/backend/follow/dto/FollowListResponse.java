package com.ssafy.backend.follow.dto;

import java.util.List;

/**
 * 팔로워·팔로잉 목록 응답 (api-spec §2.8).
 *
 * totalElements·totalPages 는 담지 않는다 — 공통 목록 래퍼(PageResponse)가 S15P21A405-255 에서
 * 두 필드를 뺐고, 다른 목록 API 도 같은 기준을 쓴다. 다음 페이지 유무는 hasNext 로 안다.
 */
public record FollowListResponse(
		String type,
		List<FollowUserSummary> content,
		int page,
		int size,
		boolean hasNext) {
}
