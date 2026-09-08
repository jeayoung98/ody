package com.ssafy.backend.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;

@RestController
@RequestMapping("/api")
public class HelloController {

	@GetMapping("/hello")
	public ApiResponse<Map<String, String>> hello() {
		return ApiResponse.success(Map.of("message", "hello"));
	}
}
