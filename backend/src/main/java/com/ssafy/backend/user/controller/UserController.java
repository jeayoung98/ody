package com.ssafy.backend.user.controller;

import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.user.dto.UserDetailResponse;
import com.ssafy.backend.user.service.UserService;

import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.constraints.NotBlank;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/user")
@Validated
@RequiredArgsConstructor
@Tag(name = "User", description = "사용자 상세 조회")
public class UserController {

	private final UserService userService;

	/**
	 * 사용자 상세 조회 (정본 §2.1). 인증 필요, 본인 조회도 이 API로 처리.
	 */
	@GetMapping("/detail")
	public ApiResponse<UserDetailResponse> detail(
			@RequestParam @NotBlank String email,
			Authentication authentication) {
		return ApiResponse.success(userService.getDetail(email, authentication.getName()));
	}
}
