package com.ssafy.backend.common;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(CustomException.class)
	public ResponseEntity<ApiResponse<Void>> handleCustomException(CustomException e) {
		ErrorCode errorCode = e.getErrorCode();
		return ResponseEntity.status(errorCode.getHttpStatus()).body(ApiResponse.fail(errorCode));
	}

	// ponytail: 검증 예외 → 400 INVALID_INPUT. master 핸들러에 없던 갭(전 엔드포인트가 검증 실패 시 500으로 떨어짐).
	// TODO(BE1): 공통 소유 파일. 이 매핑이 팀 공통 정책에 맞는지 리뷰 요청 (feat/music-search MR).
	@ExceptionHandler({
			MethodArgumentNotValidException.class,
			HandlerMethodValidationException.class,
			ConstraintViolationException.class,
			MethodArgumentTypeMismatchException.class,
			MissingServletRequestParameterException.class
	})
	public ResponseEntity<ApiResponse<Void>> handleValidation(Exception e) {
		return ResponseEntity.status(GlobalErrorCode.INVALID_INPUT.getHttpStatus())
				.body(ApiResponse.fail(GlobalErrorCode.INVALID_INPUT));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
		log.error("Unhandled exception", e);
		return ResponseEntity.status(GlobalErrorCode.INTERNAL_SERVER_ERROR.getHttpStatus())
				.body(ApiResponse.fail(GlobalErrorCode.INTERNAL_SERVER_ERROR));
	}
}
