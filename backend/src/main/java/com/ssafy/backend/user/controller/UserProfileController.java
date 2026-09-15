package com.ssafy.backend.user.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.user.dto.UserProfileUpdateRequest;
import com.ssafy.backend.user.dto.UserProfileUpdateResponse;
import com.ssafy.backend.user.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;

/**
 * 프로필 필드(닉네임, 프로필 이미지) 부분 수정 (S15P21A405-216). 구글 신규가입 시 nickname이 비어(NULL)
 * 들어가는 것을 채우기 위한 API. 인증 필요, 토큰 주체 본인 대상이라 email을 받지 않는다.
 * tutorial-completed(UserOnboardingController), is_public(UserVisibilityController, S15P21A405-300)은
 * 이 엔드포인트에서 다루지 않는다.
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@Tag(name = "User", description = "프로필(닉네임/이미지) 부분 수정")
public class UserProfileController {

	private final UserService userService;

	@Operation(summary = "프로필 부분 수정", description = "로그인한 사용자 본인의 닉네임/프로필 이미지를 부분 수정한다.")
	@PatchMapping("/profile")
	public ApiResponse<UserProfileUpdateResponse> updateProfile(
			@RequestBody UserProfileUpdateRequest request,
			Authentication authentication) {
		return ApiResponse.success(userService.updateProfile(authentication.getName(), request));
	}
}
