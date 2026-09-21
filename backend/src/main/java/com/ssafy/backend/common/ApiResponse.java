package com.ssafy.backend.common;

public record ApiResponse<T>(boolean success, T data, ErrorResponse error) {

	public static <T> ApiResponse<T> success(T data) {
		return new ApiResponse<>(true, data, null);
	}

	public static <T> ApiResponse<T> fail(ErrorCode errorCode) {
		return new ApiResponse<>(false, null, new ErrorResponse(errorCode.getCode(), errorCode.getMessage()));
	}

	public static <T> ApiResponse<T> fail(ErrorCode errorCode, java.util.Map<String, Object> details) {
		return new ApiResponse<>(false, null,
				new ErrorResponse(errorCode.getCode(), errorCode.getMessage(), details));
	}
}
