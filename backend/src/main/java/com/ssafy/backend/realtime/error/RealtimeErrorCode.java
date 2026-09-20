package com.ssafy.backend.realtime.error;

import org.springframework.http.HttpStatus;

import com.ssafy.backend.common.ErrorCode;

import lombok.Getter;

/**
 * 실시간 도메인 에러 (BE3 소유). 기존 MusicErrorCode 패턴으로 공통 ErrorCode 계약 확장.
 * 정본 §0.5 에러표에 PRESENCE_ERROR 추가 요청(BE1) — contracts/music-play.md §3.
 * WebSocket 오류 코드는 {@link WebSocketErrorCode}로 따로 관리한다.
 */
@Getter
public enum RealtimeErrorCode implements ErrorCode {

	PRESENCE_ERROR(HttpStatus.UNPROCESSABLE_ENTITY, "PRESENCE_ERROR", "실시간 처리 중 오류가 발생했습니다."),
	// 근처 사람 목록에서 이웃곡 찾기(BE2)가 준비 안됐거나 실패했을 때. 빈 목록으로 숨기지 않고 이걸로 알린다.
	SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE",
			"일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요."),

	// 따라가기. 거부 사유마다 프론트가 할 일이 달라서 하나로 뭉치지 않는다.

	/** 따라갈 사람이 곡 위에 없다. 잠시 뒤 다시 하면 된다. */
	RIDE_CAPTAIN_INACTIVE(HttpStatus.CONFLICT, "RIDE_CAPTAIN_INACTIVE",
			"지금은 따라갈 수 없는 사용자입니다."),

	/** 자기 자신을 골랐다. 언제 다시 해도 안 되므로 400. */
	RIDE_SELF(HttpStatus.BAD_REQUEST, "RIDE_SELF", "자기 자신은 따라갈 수 없습니다."),

	/** 이미 누군가를 따라가는 중이다. 갈아타려면 먼저 내려야 한다. */
	RIDE_ALREADY_RIDING(HttpStatus.CONFLICT, "RIDE_ALREADY_RIDING",
			"이미 다른 사용자를 따라가고 있습니다."),

	/** 줄줄이 따라가기다. 나를 따라오는 사람이 있거나, 상대가 남을 따라가는 중이다. */
	RIDE_CHAIN_FORBIDDEN(HttpStatus.CONFLICT, "RIDE_CHAIN_FORBIDDEN",
			"따라가기는 한 단계까지만 가능합니다."),

	/** 자리가 다 찼다. 누가 내리면 탈 수 있다. */
	RIDE_FULL(HttpStatus.CONFLICT, "RIDE_FULL", "따라가는 인원이 가득 찼습니다."),

	/** 따라가는 중이 아닌데 내리려 했다. 이미 내려졌을 수도 있다. */
	RIDE_NOT_RIDING(HttpStatus.CONFLICT, "RIDE_NOT_RIDING", "따라가는 중이 아닙니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;

	RealtimeErrorCode(HttpStatus httpStatus, String code, String message) {
		this.httpStatus = httpStatus;
		this.code = code;
		this.message = message;
	}
}
