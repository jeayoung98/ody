package com.ssafy.backend.user.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.user.dto.NicknameUpdateRequest;
import com.ssafy.backend.user.dto.NicknameUpdateResponse;
import com.ssafy.backend.user.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;

/**
 * 닉네임 수정 (S15P21A405-426). 이전 PATCH /api/user/profile 을 닉네임/이미지 두 API 로 나눈 쪽 중
 * 닉네임 담당. 인증 필요, 토큰 주체 본인 대상이라 email 을 받지 않는다.
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@Tag(name = "User", description = "닉네임 수정")
public class UserNicknameController {

	private final UserService userService;

	@Operation(summary = "닉네임 수정", description = "로그인한 사용자 본인의 닉네임을 수정한다. 중복 닉네임은 거부한다.")
	@PatchMapping("/nickname")
	public ApiResponse<NicknameUpdateResponse> updateNickname(
			@RequestBody NicknameUpdateRequest request,
			Authentication authentication) {
		return ApiResponse.success(userService.updateNickname(authentication.getName(), request));
	}
}
