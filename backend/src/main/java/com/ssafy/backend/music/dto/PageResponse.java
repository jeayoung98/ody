package com.ssafy.backend.music.dto;

import java.util.List;

/**
 * 목록 응답 공통 래퍼 (정본 §0.3). size는 참고값(서버 고정 크기).
 * user/search·playlist 등 다른 목록 API도 재사용 가능.
 *
 * totalElements·totalPages 는 뺐다 (S15P21A405-255). 프론트가 쓰지 않는다고 확인해줬고,
 * 총 건수를 세려면 매 검색마다 660만 행을 끝까지 세어야 해서 응답 시간의 ~7초를 차지했다.
 * 다음 페이지 유무는 hasNext 로 알 수 있고, 그건 한 건 더 떠보는 것으로 충분하다.
 *
 * 다른 파트가 이 래퍼를 쓸 때도 두 필드는 없다. 되살려야 할 화면이 생기면 세는 비용을
 * 먼저 재고 그 API 에만 별도로 담는다 — 공통 래퍼로 되돌리지 않는다.
 */
public record PageResponse<T>(
		List<T> content,
		int page,
		int size,
		boolean hasNext) {
}
