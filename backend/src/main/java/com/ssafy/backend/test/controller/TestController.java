package com.ssafy.backend.test.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.test.dto.TestDto;
import com.ssafy.backend.test.service.TestService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api")
@Tag(name = "Test", description = "개발용 연결 확인 API")
public class TestController {

	private final TestService testService;

	public TestController(TestService testService) {
		this.testService = testService;
	}

	@Operation(summary = "DB 연결 확인용 목록 조회", description = "개발용 테스트 데이터 목록을 조회한다.")
	@GetMapping("/test")
	public ApiResponse<List<TestDto>> getTest() {
		return ApiResponse.success(testService.getAll());
	}

	@Operation(summary = "Redis 연결 확인", description = "Redis에 ping을 보내 연결 상태를 확인한다.")
	@GetMapping("/test/redis")
	public ApiResponse<String> getTestRedis() {
		return ApiResponse.success(testService.pingRedis());
	}

	@Operation(summary = "Neo4j 연결 확인", description = "Neo4j에 ping을 보내 연결 상태를 확인한다.")
	@GetMapping("/test/neo4j")
	public ApiResponse<String> getTestNeo4j() {
		return ApiResponse.success(testService.pingNeo4j());
	}
}
