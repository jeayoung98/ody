package com.ssafy.backend.realtime.controller.rest;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.realtime.dto.ride.DismountResponse;
import com.ssafy.backend.realtime.dto.ride.RideRequest;
import com.ssafy.backend.realtime.dto.ride.RideResponse;
import com.ssafy.backend.realtime.service.ride.RideService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 따라가기 REST (RT-30). 소켓이 아니라 REST 인 이유는 실패가 사용자에게 보여야 해서다 —
 * 소켓으로 보내면 거부당했을 때 아무 응답도 오지 않아 버튼만 안 먹는 것처럼 보인다.
 *
 * realtime 프로파일에서만 뜬다 — 데모(무로그인)에선 미로드.
 */
@RestController
@RequestMapping("/api/realtime")
@Profile("realtime")
@Validated
@RequiredArgsConstructor
@Tag(name = "Ride", description = "따라가기 - 다른 사용자의 탐색을 따라간다")
public class RideRestController {

	private final RideService rideService;

	/** 따라가기 시작. 상대가 서 있는 곡으로 옮겨지고, 그가 듣던 위치부터 재생이 이어진다. */
	@Operation(summary = "따라가기 시작",
			description = "지정한 사용자의 곡·레이어로 이동하고 그가 듣던 재생 위치를 받는다. "
					+ "상대가 곡 위에 없거나, 이미 따라가는 중이거나, 인원이 가득 차면 거부한다.")
	@PostMapping("/ride")
	public ApiResponse<RideResponse> ride(@Valid @RequestBody RideRequest request, Principal principal) {
		return ApiResponse.success(rideService.mount(principal.getName(), request.captainEmail()));
	}

	/**
	 * 하차. 따라가는 동안 막아 둔 것 중에 이것만 열려 있다 — 나갈 수 없는 상태는 그 자체로 결함이다.
	 * 인솔자가 마지막으로 있던 곡에 그대로 남고, 듣던 곡은 끊기지 않는다.
	 */
	@Operation(summary = "하차",
			description = "따라가기를 끝낸다. 인솔자가 마지막으로 있던 곡에 단독으로 남고 "
					+ "서버는 어떤 재생 명령도 보내지 않는다. 따라가는 중이 아니면 거부한다.")
	@DeleteMapping("/ride")
	public ApiResponse<DismountResponse> dismount(Principal principal) {
		return ApiResponse.success(rideService.dismount(principal.getName()));
	}
}
