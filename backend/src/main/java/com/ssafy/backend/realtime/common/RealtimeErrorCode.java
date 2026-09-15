package com.ssafy.backend.realtime.common;

import org.springframework.http.HttpStatus;

import com.ssafy.backend.common.ErrorCode;

import lombok.Getter;

/**
 * 실시간 도메인 에러 (BE3 소유). 기존 MusicErrorCode 패턴으로 공통 ErrorCode 계약 확장.
 * 정본 §0.5 에러표에 PRESENCE_ERROR 추가 요청(BE1) — contracts/music-play.md §3.
 * WS 세부 사유는 WsCode 를 payload code / message 에 싣는다.
 */
@Getter
public enum RealtimeErrorCode implements ErrorCode {

	PRESENCE_ERROR(HttpStatus.UNPROCESSABLE_ENTITY, "PRESENCE_ERROR", "실시간 처리 중 오류가 발생했습니다."),
	// 근처 사람 목록에서 이웃곡 찾기(BE2)가 준비 안됐거나 실패했을 때. 빈 목록으로 숨기지 않고 이걸로 알린다.
	SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE",
			"일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;

	RealtimeErrorCode(HttpStatus httpStatus, String code, String message) {
		this.httpStatus = httpStatus;
		this.code = code;
		this.message = message;
	}

	/** WS PRESENCE_ERROR 세부 코드(/user/queue/errors payload.code). 재생 선언 전에 부르면 PRESENCE_NO_ANCHOR. */
	public enum WsCode {
		PRESENCE_NO_ANCHOR,
		PRESENCE_LOCATION_NULL,
		PRESENCE_LAYER_INVALID,
		PRESENCE_VIEWPORT_INVALID,
		PRESENCE_STALE,
		PRESENCE_NOT_CONNECTED
	}
}
