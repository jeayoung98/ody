package com.ssafy.backend.user.controller;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.user.dto.ProfileImageUpdateResponse;
import com.ssafy.backend.user.service.ProfileImageService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;

/**
 * 프로필 이미지 수정 (S15P21A405-426). multipart/form-data 로 이미지 파일 하나(part 이름 file)를 받는다.
 * 누구 이미지인지는 요청 본문이 아니라 인증 주체에서 가져온다.
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@Tag(name = "User", description = "프로필 이미지 수정")
public class UserProfileImageController {

	private final ProfileImageService profileImageService;

	@Operation(summary = "프로필 이미지 수정",
			description = "로그인한 사용자 본인의 프로필 이미지를 교체한다. jpg/png/gif/webp, 5MB 이하.")
	@PatchMapping(path = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ApiResponse<ProfileImageUpdateResponse> updateImage(
			@RequestPart("file") MultipartFile file,
			Authentication authentication) {
		return ApiResponse.success(profileImageService.updateImage(authentication.getName(), file));
	}
}
