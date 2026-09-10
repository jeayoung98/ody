package com.ssafy.backend.user.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.user.dto.TutorialCompletedResponse;
import com.ssafy.backend.user.service.UserService;

import lombok.RequiredArgsConstructor;

/**
 * 온보딩(지도 튜토리얼) 완료 처리 (S15P21A405-122). 인증 필요, 토큰 주체 본인 대상이라 email을 받지 않는다.
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserOnboardingController {

	private final UserService userService;

	@PatchMapping("/tutorial-completed")
	public ApiResponse<TutorialCompletedResponse> completeTutorial(Authentication authentication) {
		userService.completeTutorial(authentication.getName());
		return ApiResponse.success(new TutorialCompletedResponse(true));
	}
}
