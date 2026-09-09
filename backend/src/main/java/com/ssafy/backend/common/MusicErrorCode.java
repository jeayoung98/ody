package com.ssafy.backend.common;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * 음악 도메인 에러 (BE2 소유). 정본 §0.5와 정합.
 * master {@code GlobalErrorCode}에는 없는 도메인 코드를 공통 {@code ErrorCode} 계약으로 확장한다.
 */
@Getter
public enum MusicErrorCode implements ErrorCode {

	MUSIC_NOT_FOUND(HttpStatus.NOT_FOUND, "MUSIC_NOT_FOUND", "존재하지 않는 곡입니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;

	MusicErrorCode(HttpStatus httpStatus, String code, String message) {
		this.httpStatus = httpStatus;
		this.code = code;
		this.message = message;
	}
}
