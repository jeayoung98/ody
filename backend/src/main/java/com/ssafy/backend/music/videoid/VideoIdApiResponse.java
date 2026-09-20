package com.ssafy.backend.music.videoid;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * videoid 판정 API {@code GET /videoid} 응답 (S15P21A405-312, S15P21A405-441).
 *
 * <p>{@code best} 가 비면 후보를 채택하지 못한 것이고, 그것이 <b>재생 불가</b>인지
 * <b>일시 실패</b>인지는 최상위 {@code playable}·{@code retryable} 로 갈린다. 서비스가 검색 실패를
 * HTTP 오류가 아니라 {@code 200 + retryable:true} 로 돌려주므로 상태 코드로는 가릴 수 없다
 * ({@code data/videoid/api.py}).
 *
 * <p>{@code confidence}·{@code score}·{@code status} 등 나머지 필드는 읽지 않는다 — 저장 정책이
 * "엄격 검증·추측 판정 모두 저장" 이라 판정 라벨로 분기할 일이 없다(2026-09-18 결정).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record VideoIdApiResponse(VideoIdCandidate best, Boolean playable, Boolean retryable) {

	@JsonIgnoreProperties(ignoreUnknown = true)
	public record VideoIdCandidate(String videoId) {
	}

	/**
	 * 재생 불가로 <b>확정</b>할 수 있는 응답인가.
	 *
	 * <p>두 값이 모두 명시적으로 거짓일 때만 참이다. 하나라도 읽지 못하면(필드 누락·형식 변경)
	 * 판정하지 않는다 — 기록은 되돌릴 경로가 없어서, 모를 때는 다시 묻는 쪽이 싸다.
	 */
	public boolean unplayable() {
		return best == null
				&& Boolean.FALSE.equals(playable)
				&& Boolean.FALSE.equals(retryable);
	}
}
