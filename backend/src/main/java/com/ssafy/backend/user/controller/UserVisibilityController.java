package com.ssafy.backend.user.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.user.dto.PublicVisibilityUpdateRequest;
import com.ssafy.backend.user.dto.PublicVisibilityUpdateResponse;
import com.ssafy.backend.user.service.UserService;

import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;

/**
 * 공개 설정(is_public) 변경 (S15P21A405-300). 인증 필요, 토큰 주체 본인 대상이라 email을 받지 않는다.
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@Tag(name = "User", description = "공개 설정(is_public) 변경")
public class UserVisibilityController {

	private final UserService userService;

	@PatchMapping("/public")
	public ApiResponse<PublicVisibilityUpdateResponse> updatePublicVisibility(
			@RequestBody PublicVisibilityUpdateRequest request,
			Authentication authentication) {
		return ApiResponse.success(userService.updatePublicVisibility(authentication.getName(), request));
	}
}
