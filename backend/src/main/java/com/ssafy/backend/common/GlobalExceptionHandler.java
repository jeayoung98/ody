package com.ssafy.backend.common;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(CustomException.class)
	public ResponseEntity<ApiResponse<Void>> handleCustomException(CustomException e) {
		ErrorCode errorCode = e.getErrorCode();
		return ResponseEntity.status(errorCode.getHttpStatus()).body(ApiResponse.fail(errorCode, e.getDetails()));
	}

	@ExceptionHandler({
			MethodArgumentNotValidException.class,
			HandlerMethodValidationException.class,
			ConstraintViolationException.class,
			MethodArgumentTypeMismatchException.class,
			MissingServletRequestParameterException.class,
			MissingServletRequestPartException.class,
			HttpMessageNotReadableException.class
	})
	public ResponseEntity<ApiResponse<Void>> handleValidation(Exception e) {
		return ResponseEntity.status(GlobalErrorCode.INVALID_INPUT.getHttpStatus())
				.body(ApiResponse.fail(GlobalErrorCode.INVALID_INPUT));
	}

	// multipart 크기 초과는 컨트롤러에 닿기 전에 터진다. 업로드 API 가 프로필 이미지뿐이라 사용자 도메인
	// 에러 코드로 내린다 [S15P21A405-426].
	@ExceptionHandler(MaxUploadSizeExceededException.class)
	public ResponseEntity<ApiResponse<Void>> handleMaxUploadSize(MaxUploadSizeExceededException e) {
		return ResponseEntity.status(UserErrorCode.IMAGE_FILE_TOO_LARGE.getHttpStatus())
				.body(ApiResponse.fail(UserErrorCode.IMAGE_FILE_TOO_LARGE));
	}

	// 없는 경로. 포괄 핸들러보다 앞에 두지 않아도 구체 타입이 우선되지만, 읽는 순서를 위해 여기 둔다 [S15P21A405-296].
	@ExceptionHandler({ NoResourceFoundException.class, NoHandlerFoundException.class })
	public ResponseEntity<ApiResponse<Void>> handleNotFound(Exception e) {
		return ResponseEntity.status(GlobalErrorCode.NOT_FOUND.getHttpStatus())
				.body(ApiResponse.fail(GlobalErrorCode.NOT_FOUND));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
		log.error("Unhandled exception", e);
		return ResponseEntity.status(GlobalErrorCode.INTERNAL_SERVER_ERROR.getHttpStatus())
				.body(ApiResponse.fail(GlobalErrorCode.INTERNAL_SERVER_ERROR));
	}
}
