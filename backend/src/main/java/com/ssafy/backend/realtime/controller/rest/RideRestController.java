package com.ssafy.backend.realtime.controller.rest;

import java.security.Principal;
import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.realtime.dto.ride.DisbandResponse;
import com.ssafy.backend.realtime.dto.ride.DismountResponse;
import com.ssafy.backend.realtime.dto.ride.RideRankingItem;
import com.ssafy.backend.realtime.dto.ride.RideRequest;
import com.ssafy.backend.realtime.dto.ride.RideResponse;
import com.ssafy.backend.realtime.service.ride.RideRankingService;
import com.ssafy.backend.realtime.service.ride.RideService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
	private final RideRankingService rideRankingService;

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

	/**
	 * 해체. 따라오던 사람을 한 번에 전부 내린다.
	 *
	 * 위의 하차와 경로가 닮았지만 내리는 사람이 다르다 — 하차는 부른 사람 자신이 내리고,
	 * 이쪽은 부른 사람을 따라오던 사람들이 내린다. 인솔자 자신은 움직이지 않는다.
	 *
	 * 따라오는 사람이 없으면 인솔자가 아니므로 거부한다.
	 */
	@Operation(summary = "해체",
			description = "따라오던 사람을 전부 내린다. 내린 사람들은 인솔자가 서 있는 곡에 그대로 "
					+ "남고 듣던 곡도 끊기지 않는다. 인솔자 자신은 움직이지 않는다. "
					+ "따라오는 사람이 없으면 거부한다.")
	@DeleteMapping("/ride/fleet")
	public ApiResponse<DisbandResponse> disband(Principal principal) {
		return ApiResponse.success(rideService.disbandByCaptain(principal.getName()));
	}

	/**
	 * 실시간 탑 버스기사. 지금 따라오는 사람이 가장 많은 순으로 준다.
	 *
	 * 누가 물어도 같은 답이라 토큰의 이메일을 쓰지 않는다. 다만 인증은 필요하다 —
	 * 목록에 이메일이 실리므로 로그인하지 않은 쪽에 내보내지 않는다.
	 */
	@Operation(summary = "실시간 탑 버스기사",
			description = "지금 따라오는 사람이 가장 많은 사용자를 인원 많은 순으로 준다. "
					+ "인원이 같으면 닉네임 오름차순이다. 아무도 태우고 있지 않으면 빈 목록이다.")
	@GetMapping("/ride/ranking")
	public ApiResponse<List<RideRankingItem>> ranking(
			@RequestParam(defaultValue = "10") @Min(1) @Max(10) int limit) {
		return ApiResponse.success(rideRankingService.top(limit));
	}
}
