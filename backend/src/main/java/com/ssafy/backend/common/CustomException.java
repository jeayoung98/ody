package com.ssafy.backend.common;

import java.util.Map;

import lombok.Getter;

@Getter
public class CustomException extends RuntimeException {

	private final ErrorCode errorCode;
	private final Map<String, Object> details;

	public CustomException(ErrorCode errorCode) {
		this(errorCode, Map.of());
	}

	public CustomException(ErrorCode errorCode, Map<String, Object> details) {
		super(errorCode.getMessage());
		this.errorCode = errorCode;
		this.details = Map.copyOf(details);
	}
}
