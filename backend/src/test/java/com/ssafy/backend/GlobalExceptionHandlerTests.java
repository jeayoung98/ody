package com.ssafy.backend;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.common.GlobalExceptionHandler;

/** 없는 경로는 500 이 아니라 404 NOT_FOUND (S15P21A405-296). 포괄 Exception 핸들러가 삼키던 것. */
class GlobalExceptionHandlerTests {

	private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

	@Test
	void noResourceFound_returns404NotFound() {
		ResponseEntity<ApiResponse<Void>> response =
				handler.handleNotFound(new NoResourceFoundException(HttpMethod.GET, "/api/definitely-not-here", "/api/definitely-not-here"));

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
		assertThat(response.getBody().success()).isFalse();
		assertThat(response.getBody().error().code()).isEqualTo("NOT_FOUND");
	}

	@Test
	void otherException_still500() {
		ResponseEntity<ApiResponse<Void>> response = handler.handleException(new IllegalStateException("x"));
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
	}
}
