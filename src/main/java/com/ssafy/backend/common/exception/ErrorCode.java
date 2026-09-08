package com.ssafy.backend.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 에러 코드 (정본 §0.5). 지금 쓰는 것만 등록하고, API를 추가할 때마다 해당 코드를 추가한다.
 * ponytail: 전체 코드 미리 나열하지 않음(YAGNI). 필요 시 확장.
 */
public enum ErrorCode {

	VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "필수 파라미터가 누락되었습니다."),
	MUSIC_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 곡입니다."),
	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다.");

	private final HttpStatus status;
	private final String message;

	ErrorCode(HttpStatus status, String message) {
		this.status = status;
		this.message = message;
	}

	public HttpStatus getStatus() {
		return status;
	}

	public String getMessage() {
		return message;
	}
}
