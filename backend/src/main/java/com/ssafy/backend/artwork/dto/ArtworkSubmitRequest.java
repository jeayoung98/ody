package com.ssafy.backend.artwork.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 작품 제출 요청.
 *
 * <p>회차를 받지 않는 것은 의도다 — 제출은 언제나 "지금 열린 회차" 로 간다. 회차를 고르게 하면
 * 지난 회차에 뒤늦게 작품을 끼워 넣을 수 있다.
 */
public record ArtworkSubmitRequest(
		@NotNull @Min(1) Long playlistId,
		/** 닫힌 모양 (S15P21A405-616). 선택 — 없으면 열린 모양이라 기존 클라이언트가 그대로 동작한다. */
		Boolean closed) {
}
