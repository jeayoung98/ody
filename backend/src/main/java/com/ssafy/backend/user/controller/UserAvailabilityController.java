package com.ssafy.backend.user.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.user.dto.NicknameAvailabilityResponse;
import com.ssafy.backend.user.service.UserAvailabilityService;

import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.constraints.NotBlank;

import lombok.RequiredArgsConstructor;

/**
 * 회원가입 전 사용 가능 여부 조회 (S15P21A405-121). 로그인 전 호출되므로 인증 불필요.
 */
@RestController
@RequestMapping("/api/users")
@Validated
@RequiredArgsConstructor
@Tag(name = "User", description = "닉네임 사용 가능 여부 조회")
public class UserAvailabilityController {

	private final UserAvailabilityService userAvailabilityService;

	@GetMapping("/nickname-available")
	public ApiResponse<NicknameAvailabilityResponse> nicknameAvailable(
			@RequestParam @NotBlank String nickname) {
		boolean available = userAvailabilityService.isNicknameAvailable(nickname);
		return ApiResponse.success(new NicknameAvailabilityResponse(available));
	}
}
