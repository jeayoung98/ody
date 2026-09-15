package com.ssafy.backend.test.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api")
@Tag(name = "Test", description = "개발용 연결 확인 API")
public class HelloController {

	@Operation(summary = "서버 동작 확인", description = "서버가 정상 동작하는지 확인하는 개발용 헬스 체크 API.")
	@GetMapping("/hello")
	public ApiResponse<Map<String, String>> hello() {
		return ApiResponse.success(Map.of("message", "hello"));
	}
}
