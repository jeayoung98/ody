package com.ssafy.backend.realtime.controller.rest;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.realtime.dto.layer.LayerUsersSnapshot;
import com.ssafy.backend.realtime.service.layer.LayerUsersService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/**
 * 레이어의 재생 중 사용자 전체 조회. 지도가 줌 레벨과 무관하게 사용자를 전부 그릴 때 부른다.
 * 실시간 push 없음 — 레이어 전환 시와 주기 폴링으로 다시 부른다. realtime 프로파일에서만 뜬다.
 */
@RestController
@RequestMapping("/api/realtime")
@Profile("realtime")
@RequiredArgsConstructor
@Tag(name = "LayerUsers", description = "레이어 내 재생 중 사용자 전체 (위치·닉네임·사진)")
public class LayerUsersRestController {

	private final LayerUsersService layerUsersService;

	/** principal 이 있으면 본인을 뺀다. 없으면(비인증 경로) 전부 준다. */
	@Operation(summary = "레이어 사용자 전체 조회",
			description = "그 레이어(0-based)에서 재생 중인 사용자 전부를 곡 위치별로 묶어 준다. 본인은 제외.")
	@GetMapping("/layers/{layer}/users")
	public ApiResponse<LayerUsersSnapshot> users(@PathVariable int layer, Principal principal) {
		return ApiResponse.success(
				layerUsersService.findAll(layer, principal == null ? null : principal.getName()));
	}
}
