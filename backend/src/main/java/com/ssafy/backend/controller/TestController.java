package com.ssafy.backend.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.dto.TestDto;
import com.ssafy.backend.service.TestService;

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
}
