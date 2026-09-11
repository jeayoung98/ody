package com.ssafy.backend.common;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * 사용자 도메인 에러. 정본 §0.5와 정합.
 */
@Getter
public enum UserErrorCode implements ErrorCode {

	USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "존재하지 않는 사용자입니다."),
	USER_PRIVATE(HttpStatus.FORBIDDEN, "USER_PRIVATE", "비공개 사용자입니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;

	UserErrorCode(HttpStatus httpStatus, String code, String message) {
		this.httpStatus = httpStatus;
		this.code = code;
		this.message = message;
	}
}
