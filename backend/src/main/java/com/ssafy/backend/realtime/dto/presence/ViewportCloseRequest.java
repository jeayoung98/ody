package com.ssafy.backend.realtime.dto.presence;

/** 마지막으로 연 화면을 닫는 요청. */
public record ViewportCloseRequest(Long requestSeq) {

	/**
	 * 화면 요청 순번이 올바른지 확인한다.
	 *
	 * @return 확인된 화면 요청 순번
	 */
	public long validatedRequestSeq() {
		if (requestSeq == null || requestSeq <= 0) {
			throw new IllegalArgumentException("화면 요청 순번은 1 이상이어야 한다");
		}
		return requestSeq;
	}
}
