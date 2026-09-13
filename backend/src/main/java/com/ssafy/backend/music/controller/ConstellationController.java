package com.ssafy.backend.music.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.music.dto.ConstellationLayoutRequest;
import com.ssafy.backend.music.dto.ConstellationLayoutResponse;
import com.ssafy.backend.music.service.ConstellationService;

import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

/**
 * 별자리 배치 (PATH-01, BACKEND-NOTES A-9).
 *
 * <p>경로는 A-9 문서와 프론트 상수({@code API_ENDPOINTS.constellation.layout})를 그대로 따랐다.
 * 다른 도메인이 단수형({@code /api/music}, {@code /api/playlist})이라 표기가 어긋나지만 설계가 아니라
 * 표기 문제이고, 여기서 임의로 바꾸면 프론트가 두 번 고쳐야 한다 — 통일은 S15P21A405-213·214 에서 함께 한다.
 *
 * <p>사용자별로 결과가 달라지지 않으므로 {@code Authentication} 주체를 읽지 않는다.
 */
@RestController
@RequestMapping("/api/constellations")
@Validated
@Tag(name = "Constellation", description = "별자리 배치 — 곡 집합의 2D 고정 좌표")
public class ConstellationController {

	private final ConstellationService constellationService;

	public ConstellationController(ConstellationService constellationService) {
		this.constellationService = constellationService;
	}

	/** 곡 id 목록(2~30개)을 받아 곡별 -1~1 배치 좌표를 돌려준다. 같은 집합이면 항상 같은 좌표다. */
	@PostMapping("/layout")
	public ApiResponse<ConstellationLayoutResponse> layout(@RequestBody @Valid ConstellationLayoutRequest request) {
		return ApiResponse.success(constellationService.layout(request.musicIds()));
	}
}
