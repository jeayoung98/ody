package com.ssafy.backend.realtime.messaging;

/**
 * 모든 S→C 프레임의 봉투 {type, seq, ts, payload} (FR-041). REST ApiResponse 규격은 WS 에 적용하지 않는다.
 *
 * @param seq 세션 단위 단조 증가 — 클라이언트 gap 감지·순서 역전 폐기용(R-07). 발급은 publishToUser 에서.
 */
public record RealtimeEnvelope<T>(RealtimeEventType type, long seq, long ts, T payload) {

	public static <T> RealtimeEnvelope<T> of(RealtimeEventType type, long seq, T payload) {
		return new RealtimeEnvelope<>(type, seq, System.currentTimeMillis(), payload);
	}
}
