package com.ssafy.backend.common.response;

import com.ssafy.backend.common.exception.ErrorCode;

/**
 * 공통 응답 포맷 (정본 §0.2). 실제 공통 모듈은 BE1 소유이며, 준서님 모듈이 올라오면 교체한다.
 * ponytail: 임시 최소 구현. 교체 시 이 패키지 삭제.
 */
public record ApiResponse<T>(boolean success, T data, ErrorBody error) {

	public record ErrorBody(String code, String message) {
	}

	public static <T> ApiResponse<T> ok(T data) {
		return new ApiResponse<>(true, data, null);
	}

	public static <T> ApiResponse<T> fail(ErrorCode errorCode, String message) {
		return new ApiResponse<>(false, null, new ErrorBody(errorCode.name(), message));
	}

	public static <T> ApiResponse<T> fail(ErrorCode errorCode) {
		return fail(errorCode, errorCode.getMessage());
	}
}
