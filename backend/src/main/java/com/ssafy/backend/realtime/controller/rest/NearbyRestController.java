package com.ssafy.backend.realtime.controller.rest;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;
import com.ssafy.backend.realtime.service.ride.RideGuard;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

import com.ssafy.backend.common.ApiResponse;

/**
 *  주변사람 패널을 열 때 전체 목록을 반환하고 실시간 변경 구독을 시작한다.
 *  HTTP REST 요청 → 패널 열기 → 전체 목록 반환 + 실시간 구독 시작
 *
 * realtime 프로파일에서만 뜬다 — 데모(무로그인)에선 미로드.
 */
@RestController
@RequestMapping("/api/realtime")
@Profile("realtime")
@RequiredArgsConstructor
@Tag(name = "Nearby", description = "주변사람 - 내 곡과 비슷한 곡 듣는 사람 목록")
public class NearbyRestController {

	private final NearbyPeopleService nearbyPeopleService;
	private final RideGuard rideGuard; // 따라가는 중에는 스스로 주변 사람을 열지 못하게 막는다

	/** 주변사람 목록 조회.
	 * 내가 지금 듣는 곡 기준으로 비슷한 곡 듣는 사람들을 가까운 순으로 주고,
	 * 목록에 이미 반영된 소켓 메시지의 마지막 순번도 함께 준다. (소켓과 rest의 시차로 이미 반영된건  버림/반영 선택용) */
	@Operation(summary = "주변사람 목록 조회", description = "내가 지금 듣는 곡과 비슷한 곡을 듣는 사람을 가까운 순으로 조회한다.")
	@PostMapping("/nearby")
	public ApiResponse<NearbySnapshot> nearby(Principal principal) {
		// 주변 사람은 내가 듣는 곡을 기준으로 만든다. 따라가는 동안 열면
		// 인솔자 곡 기준 목록이 오고 그 곡의 변화를 계속 받게 돼 화면이 섞인다.
		rideGuard.requireNotRidingOnRest(principal.getName());
		return ApiResponse.success(nearbyPeopleService.open(principal.getName()));
	}
}
