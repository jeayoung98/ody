package com.ssafy.backend.common;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * 플레이리스트 도메인 에러 (BE1 소유). 정본 §0.5, §4와 정합.
 */
@Getter
public enum PlaylistErrorCode implements ErrorCode {

	PLAYLIST_NOT_FOUND(HttpStatus.NOT_FOUND, "PLAYLIST_NOT_FOUND", "존재하지 않는 플레이리스트입니다."),
	PLAYLIST_NAME_DUPLICATED(HttpStatus.CONFLICT, "PLAYLIST_NAME_DUPLICATED", "같은 이름의 플레이리스트가 이미 있습니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;

	PlaylistErrorCode(HttpStatus httpStatus, String code, String message) {
		this.httpStatus = httpStatus;
		this.code = code;
		this.message = message;
	}
}
