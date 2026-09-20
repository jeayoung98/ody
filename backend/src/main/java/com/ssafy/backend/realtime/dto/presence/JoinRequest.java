package com.ssafy.backend.realtime.dto.presence;

import jakarta.validation.constraints.NotNull;

/**
 * C→S /app/presence/join — 서 있던 자리로 돌아오거나 레이어를 옮긴다.
 * musicId 는 참고값이다. 서버는 첫 입장이면 마지막 재생 기록, 이후엔 현재 곡을 쓰고,
 * 실제로 적용한 곡은 PresenceJoined 로 돌려준다. 재생 기록이 없으면 입장이 거부된다.
 */
public record JoinRequest(
		@NotNull Long requestSeq,
		@NotNull Integer layer, // 0-based (0 ~ 7), 프론트와 같다
		@NotNull Long musicId) {

	/** 요청값을 검사한다. */
	public void validate() {
		if (requestSeq == null || requestSeq < 1) {
			throw new IllegalArgumentException("입장 요청 순번은 1 이상이어야 한다");
		}
		if (layer == null || layer < 0) {
			throw new IllegalArgumentException("레이어는 0 이상이어야 한다");
		}
		if (musicId == null || musicId < 1) {
			throw new IllegalArgumentException("곡 ID는 1 이상이어야 한다");
		}
	}
}
