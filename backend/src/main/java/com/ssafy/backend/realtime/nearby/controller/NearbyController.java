package com.ssafy.backend.realtime.nearby.controller;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.realtime.nearby.dto.NearbySnapshot;
import com.ssafy.backend.realtime.nearby.service.NearbyPeopleService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/**
 * 주변사람 버튼 (RT-10, S15P21A405-309). 본인 대상 API — 누구인지는 토큰에서 꺼낸다(Principal), 몸통(body) 없음.
 * 버튼 누르면 이걸 한 번 부르고 목록을 받는다. 이후 사람이 들고 나는 변화는 소켓으로 따로 온다(델타, T2)
 * realtime 프로파일에서만 뜬다 — 데모(무로그인)에선 미로드.
 * 실제 인증하려면 SecurityConfig 에서 /api/realtime/** 를 authenticated() 로 올려야 한다(현재 permitAll → principal=null).
 */
@RestController
@RequestMapping("/api/realtime")
@Profile("realtime")
@RequiredArgsConstructor
@Tag(name = "Nearby", description = "주변사람 - 내 곡과 비슷한 곡 듣는 사람 목록")
public class NearbyController {

	private final NearbyPeopleService nearbyPeopleService;

	/** 주변사람 목록 조회. 내가 지금 듣는 곡 기준으로 비슷한 곡 듣는 사람들을 가까운 순으로 준다. */
	@Operation(summary = "주변사람 목록 조회", description = "내가 지금 듣는 곡과 비슷한 곡을 듣는 사람을 가까운 순으로 조회한다.")
	@PostMapping("/nearby")
	public ApiResponse<NearbySnapshot> nearby(Principal principal) {
		return ApiResponse.success(nearbyPeopleService.open(principal.getName()));
	}
}
