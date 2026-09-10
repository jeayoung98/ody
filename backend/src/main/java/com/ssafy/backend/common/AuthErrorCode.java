package com.ssafy.backend.common;

import org.springframework.http.HttpStatus;

import lombok.Getter;

@Getter
public enum AuthErrorCode implements ErrorCode {

	UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "인증이 필요합니다."),
	INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "INVALID_TOKEN", "유효하지 않은 토큰입니다."),
	REFRESH_TOKEN_NOT_FOUND(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_NOT_FOUND", "리프레시 토큰이 없습니다."),
	REFRESH_TOKEN_MISMATCH(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_MISMATCH", "리프레시 토큰이 일치하지 않습니다. 다시 로그인해주세요."),
	INVALID_EXCHANGE_CODE(HttpStatus.UNAUTHORIZED, "INVALID_EXCHANGE_CODE", "유효하지 않거나 만료된 코드입니다."),
	EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "이미 가입된 이메일입니다."),
	NICKNAME_ALREADY_EXISTS(HttpStatus.CONFLICT, "NICKNAME_ALREADY_EXISTS", "이미 사용 중인 닉네임입니다."),
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다."),
	PASSWORD_MISMATCH(HttpStatus.UNAUTHORIZED, "PASSWORD_MISMATCH", "비밀번호가 올바르지 않습니다."),
	INVALID_PASSWORD_FORMAT(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD_FORMAT", "비밀번호는 영문과 숫자를 포함해 8~72자여야 합니다."),
	INVALID_NICKNAME_LENGTH(HttpStatus.BAD_REQUEST, "INVALID_NICKNAME_LENGTH", "닉네임은 2~20자여야 합니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;

	AuthErrorCode(HttpStatus httpStatus, String code, String message) {
		this.httpStatus = httpStatus;
		this.code = code;
		this.message = message;
	}
}
