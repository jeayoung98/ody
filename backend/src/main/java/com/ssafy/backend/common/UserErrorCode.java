package com.ssafy.backend.common;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * 사용자 도메인 에러. 정본 §0.5와 정합.
 */
@Getter
public enum UserErrorCode implements ErrorCode {

	USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "존재하지 않는 사용자입니다."),
	USER_PRIVATE(HttpStatus.FORBIDDEN, "USER_PRIVATE", "비공개 사용자입니다."),

	// 프로필 이미지 업로드 (S15P21A405-426)
	INVALID_IMAGE_FILE(HttpStatus.BAD_REQUEST, "INVALID_IMAGE_FILE", "지원하지 않는 이미지 파일입니다."),
	IMAGE_FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "IMAGE_FILE_TOO_LARGE", "이미지 파일 크기가 허용치를 초과했습니다."),
	IMAGE_UPLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "IMAGE_UPLOAD_FAILED", "프로필 이미지 저장에 실패했습니다."),

	// 팔로우 (api-spec §0.5, S15P21A405-433)
	ALREADY_FOLLOWING(HttpStatus.CONFLICT, "ALREADY_FOLLOWING", "이미 팔로우한 사용자입니다."),
	SELF_FOLLOW_NOT_ALLOWED(HttpStatus.BAD_REQUEST, "SELF_FOLLOW_NOT_ALLOWED", "자신을 팔로우할 수 없습니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;

	UserErrorCode(HttpStatus httpStatus, String code, String message) {
		this.httpStatus = httpStatus;
		this.code = code;
		this.message = message;
	}
}
