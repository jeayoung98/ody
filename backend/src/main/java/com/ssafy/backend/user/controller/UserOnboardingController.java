package com.ssafy.backend.user.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.user.dto.TutorialCompletedResponse;
import com.ssafy.backend.user.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;

/**
 * 온보딩(지도 튜토리얼) 완료 처리 (S15P21A405-122). 인증 필요, 토큰 주체 본인 대상이라 email을 받지 않는다.
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@Tag(name = "User", description = "온보딩 튜토리얼 완료 처리")
public class UserOnboardingController {

	private final UserService userService;

	@Operation(summary = "온보딩 튜토리얼 완료 처리", description = "로그인한 사용자 본인의 지도 튜토리얼 완료 여부를 완료로 저장한다.")
	@PatchMapping("/tutorial-completed")
	public ApiResponse<TutorialCompletedResponse> completeTutorial(Authentication authentication) {
		userService.completeTutorial(authentication.getName());
		return ApiResponse.success(new TutorialCompletedResponse(true));
	}
}
