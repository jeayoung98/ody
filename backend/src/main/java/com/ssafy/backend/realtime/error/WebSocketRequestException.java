package com.ssafy.backend.realtime.error;

import lombok.Getter;

/** 소켓 요청 실패 원인을 개인 오류 큐로 전달하기 위한 예외. */
@Getter
public class WebSocketRequestException extends RuntimeException {

	private final WebSocketErrorCode code;

	public WebSocketRequestException(WebSocketErrorCode code, String message) {
		super(message);
		this.code = code;
	}
}
