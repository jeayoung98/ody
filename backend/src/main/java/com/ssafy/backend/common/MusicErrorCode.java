package com.ssafy.backend.common;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * 음악 도메인 에러 (BE2 소유). 정본 §0.5와 정합.
 * master {@code GlobalErrorCode}에는 없는 도메인 코드를 공통 {@code ErrorCode} 계약으로 확장한다.
 */
@Getter
public enum MusicErrorCode implements ErrorCode {

	MUSIC_NOT_FOUND(HttpStatus.NOT_FOUND, "MUSIC_NOT_FOUND", "존재하지 않는 곡입니다."),

	/**
	 * 경로 탐색 실패 (정본 §3.3·§0.5). 두 곡은 모두 존재하나 엔진이 경로를 만들지 못한 경우.
	 * 엔진 부재·타임아웃은 이 코드가 아니라 INTERNAL_SERVER_ERROR 다 — 사용자가 곡을 바꿔
	 * 해결할 수 있는 실패가 아니기 때문이다(2026-09-10 clarify).
	 */
	PATH_NOT_FOUND(HttpStatus.UNPROCESSABLE_CONTENT, "PATH_NOT_FOUND",
			"두 곡을 연결하는 경로를 찾을 수 없습니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;

	MusicErrorCode(HttpStatus httpStatus, String code, String message) {
		this.httpStatus = httpStatus;
		this.code = code;
		this.message = message;
	}
}
