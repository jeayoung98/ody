package com.ssafy.backend.realtime.dto.presence;

import jakarta.validation.constraints.NotNull;

/**
 * C→S /app/presence/join — 처음에는 요청 곡으로 입장하고, 이후에는 서버의 현재 곡으로 레이어만 옮긴다.
 */
public record JoinRequest(
		@NotNull Long requestSeq,
		@NotNull Integer layer,
		@NotNull Long musicId) {

	/** 요청값을 검사한다. */
	public void validate() {
		if (requestSeq == null || requestSeq < 1) {
			throw new IllegalArgumentException("입장 요청 순번은 1 이상이어야 한다");
		}
		if (layer == null || layer < 1) {
			throw new IllegalArgumentException("레이어는 1 이상이어야 한다");
		}
		if (musicId == null || musicId < 1) {
			throw new IllegalArgumentException("곡 ID는 1 이상이어야 한다");
		}
	}
}
