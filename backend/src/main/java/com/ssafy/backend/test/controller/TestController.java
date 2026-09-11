package com.ssafy.backend.test.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.test.dto.TestDto;
import com.ssafy.backend.test.service.TestService;

@RestController
@RequestMapping("/api")
public class TestController {

	private final TestService testService;

	public TestController(TestService testService) {
		this.testService = testService;
	}

	@GetMapping("/test")
	public ApiResponse<List<TestDto>> getTest() {
		return ApiResponse.success(testService.getAll());
	}

	@GetMapping("/test/redis")
	public ApiResponse<String> getTestRedis() {
		return ApiResponse.success(testService.pingRedis());
	}

	@GetMapping("/test/neo4j") 
	public ApiResponse<String> getTestNeo4j() {
		return ApiResponse.success(testService.pingNeo4j());
	}
}
