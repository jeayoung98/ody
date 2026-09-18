package com.ssafy.backend.follow.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.follow.dto.FollowListResponse;
import com.ssafy.backend.follow.dto.FollowRequest;
import com.ssafy.backend.follow.dto.FollowResponse;
import com.ssafy.backend.follow.service.FollowService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;

/**
 * 팔로우 등록·해제·목록 (api-spec §2.5~§2.8, S15P21A405-433).
 *
 * 경로는 api-spec 의 이름(follow/insert·delete·list)에 이 저장소의 컨트롤러 컨벤션인 /api/user
 * 접두를 붙였다. 팔로우를 거는 쪽은 토큰 주체라 요청 본문에 없다.
 */
@RestController
@RequestMapping("/api/user/follow")
@RequiredArgsConstructor
@Tag(name = "Follow", description = "팔로우 등록·해제·팔로워/팔로잉 목록")
public class FollowController {

	private final FollowService followService;

	@Operation(summary = "팔로우 등록", description = "로그인한 사용자가 followeeEmail 사용자를 팔로우한다.")
	@PostMapping("/insert")
	public ApiResponse<FollowResponse> follow(
			@RequestBody FollowRequest request,
			Authentication authentication) {
		return ApiResponse.success(followService.follow(authentication.getName(), request));
	}

	@Operation(summary = "팔로우 해제", description = "팔로우를 끊는다. 팔로우 중이 아니어도 200 이다.")
	@PostMapping("/delete")
	public ApiResponse<FollowResponse> unfollow(
			@RequestBody FollowRequest request,
			Authentication authentication) {
		return ApiResponse.success(followService.unfollow(authentication.getName(), request));
	}

	@Operation(summary = "팔로워/팔로잉 목록",
			description = "type=follower 면 그 사용자를 팔로우하는 사람들, following 이면 그 사용자가 팔로우하는 사람들.")
	@GetMapping("/list")
	public ApiResponse<FollowListResponse> list(
			@RequestParam String email,
			@RequestParam String type,
			@RequestParam(required = false, defaultValue = "0") Integer page,
			Authentication authentication) {
		return ApiResponse.success(followService.list(email, type, page, authentication.getName()));
	}
}
