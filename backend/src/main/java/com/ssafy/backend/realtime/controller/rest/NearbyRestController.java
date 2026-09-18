package com.ssafy.backend.realtime.controller.rest;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/**
 *  주변사람 패널을 열 때 전체 목록을 반환하고 실시간 변경 구독을 시작한다.
 *  HTTP REST 요청 → 패널 열기 → 전체 목록 반환 + 실시간 구독 시작
 *
 * realtime 프로파일에서만 뜬다 — 데모(무로그인)에선 미로드.
 *
 * 인증 검사는 지금 {@link #requireEmail} 가 대신 한다 — SecurityConfig 가 데모 때문에
 * /api/realtime/** 까지 permitAll 이라 필터 체인이 막아주지 않는다. 아래 주석 참고.
 */
@RestController
@RequestMapping("/api/realtime")
@Profile("realtime")
@RequiredArgsConstructor
@Tag(name = "Nearby", description = "주변사람 - 내 곡과 비슷한 곡 듣는 사람 목록")
public class NearbyRestController {

	private final NearbyPeopleService nearbyPeopleService;

	/**
	 * 로그인 사용자 이메일을 꺼낸다. 인증이 없으면 401 로 거부한다.
	 *
	 * <p><b>임시 방어다.</b> SecurityConfig 가 FE 연동 테스트용으로 anyRequest().permitAll()
	 * 상태라(S15P21A405-243) 토큰이 없거나 만료된 요청도 여기까지 들어오고, 그때 principal 이
	 * null 이 된다. 그대로 두면 NPE 로 500 이 나가는데, 프론트는 401 에서만 액세스 토큰을
	 * 재발급하므로 만료를 스스로 복구하지 못한다. 401 로 내려야 재발급 후 재시도가 돈다.
	 *
	 * <p>SecurityConfig 가 anyRequest().authenticated() 로 원복되면 필터 체인이 먼저 401 을
	 * 내주므로 이 검사는 죽은 코드가 된다. <b>원복할 때 이 메서드와 호출부를 함께 지운다.</b>
	 *
	 * @param principal 인증된 사용자. permitAll 구간에서는 null 일 수 있다
	 * @return 사용자 이메일
	 * @throws CustomException 인증이 없으면 401 UNAUTHENTICATED
	 */
	private static String requireEmail(Principal principal) {
		if (principal == null) {
			throw new CustomException(AuthErrorCode.UNAUTHENTICATED);
		}
		return principal.getName();
	}

	/** 주변사람 목록 조회.
	 * 내가 지금 듣는 곡 기준으로 비슷한 곡 듣는 사람들을 가까운 순으로 주고,
	 * 목록에 이미 반영된 소켓 메시지의 마지막 순번도 함께 준다. (소켓과 rest의 시차로 이미 반영된건  버림/반영 선택용) */
	@Operation(summary = "주변사람 목록 조회", description = "내가 지금 듣는 곡과 비슷한 곡을 듣는 사람을 가까운 순으로 조회한다.")
	@PostMapping("/nearby")
	public ApiResponse<NearbySnapshot> nearby(Principal principal) {
		return ApiResponse.success(nearbyPeopleService.open(requireEmail(principal)));
	}
}
