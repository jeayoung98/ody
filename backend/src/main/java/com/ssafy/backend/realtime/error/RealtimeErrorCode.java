package com.ssafy.backend.realtime.error;

import org.springframework.http.HttpStatus;

import com.ssafy.backend.common.ErrorCode;

import lombok.Getter;

/**
 * 실시간 기능이 REST 로 돌려주는 오류 코드.
 *
 * 거부 사유마다 받는 쪽이 할 일이 다르다. 다시 해 보면 되는 것과 아무리 해도 안 되는 것을
 * 한 코드로 뭉치면 구분할 수 없어서 사유별로 나눠 둔다.
 * 소켓으로 나가는 오류는 {@link WebSocketErrorCode} 에 따로 있다.
 */
@Getter
public enum RealtimeErrorCode implements ErrorCode {

	/** 실시간 처리 중에 난 그 밖의 오류. */
	PRESENCE_ERROR(HttpStatus.UNPROCESSABLE_ENTITY, "PRESENCE_ERROR", "실시간 처리 중 오류가 발생했습니다."),

	/**
	 * 주변 사람 목록을 만들 때 쓰는 이웃곡 찾기가 아직 준비되지 않았거나 실패했다.
	 * 빈 목록으로 내보내면 "아무도 없다"로 보이기 때문에 그렇게 숨기지 않고 이 코드로 알린다.
	 */
	SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE",
			"일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요."),

	// 아래는 따라가기가 거부되는 사유들이다.

	/** 따라갈 사람이 곡 위에 없다. 잠시 뒤 다시 하면 된다. */
	RIDE_CAPTAIN_INACTIVE(HttpStatus.CONFLICT, "RIDE_CAPTAIN_INACTIVE",
			"지금은 따라갈 수 없는 사용자입니다."),

	/** 자기 자신을 골랐다. 언제 다시 해도 안 되므로 400 이다. */
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
	RIDE_NOT_RIDING(HttpStatus.CONFLICT, "RIDE_NOT_RIDING", "따라가는 중이 아닙니다."),

	/**
	 * 따라가는 중이라 스스로 할 수 없는 동작이다. 내리면 된다.
	 * 소켓으로 같은 일이 막힐 때도 {@code WebSocketErrorCode.RIDE_NOT_CAPTAIN} 으로 같은 이름이 나간다.
	 */
	RIDE_NOT_CAPTAIN(HttpStatus.CONFLICT, "RIDE_NOT_CAPTAIN",
			"따라가는 중에는 할 수 없습니다. 먼저 내려 주세요."),

	/**
	 * 요청과 서버의 상태가 어긋났다. 그 사이에 다른 사람을 따라가기 시작했거나,
	 * 이전 연결에서 만든 탑승이거나, 서 있는 자리가 없다.
	 * 화면을 새로 고치면 풀린다 — 접속 문제와 구분하려고 따로 둔다.
	 */
	RIDE_STALE(HttpStatus.CONFLICT, "RIDE_STALE",
			"따라가기 상태가 바뀌었습니다. 화면을 새로 고쳐 주세요.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;

	RealtimeErrorCode(HttpStatus httpStatus, String code, String message) {
		this.httpStatus = httpStatus;
		this.code = code;
		this.message = message;
	}
}
