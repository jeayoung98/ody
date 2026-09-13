package com.ssafy.backend.common;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
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

	@ExceptionHandler({
			MethodArgumentNotValidException.class,
			HandlerMethodValidationException.class,
			ConstraintViolationException.class,
			MethodArgumentTypeMismatchException.class,
			MissingServletRequestParameterException.class,
			HttpMessageNotReadableException.class
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
