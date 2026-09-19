package com.ssafy.backend.realtime.controller.rest;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.dto.play.PlayEndRequest;
import com.ssafy.backend.realtime.dto.play.PlayRequest;
import com.ssafy.backend.realtime.dto.play.PlayResponse;
import com.ssafy.backend.realtime.service.play.MusicPlayService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 재생 선언·종료 REST (RT-02, S15P21A405-272). 본인 대상 API — email 은 토큰 subject(Principal).
 * realtime 프로파일에서만 활성 — 데모(무로그인)에선 미로드.
 *
 * 인증 검사는 지금 {@link #requireEmail} 가 대신 한다 — SecurityConfig 가 데모 때문에
 * /api/music/play* 까지 permitAll 이라 필터 체인이 막아주지 않는다. 아래 주석 참고.
 */
@RestController
@RequestMapping("/api/music")
@Profile("realtime")
@Validated
@RequiredArgsConstructor
@Tag(name = "MusicPlay", description = "재생 선언·종료 (실시간 위치 이동)")
public class MusicPlayRestController {

	private final MusicPlayService musicPlayService;

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

	/**
	 * 재생 선언 = 위치 이동의 유일한 원본. musicId 로 서버가 좌표를 계산한다.
	 * layer 는 처음 자리를 잡을 때만 쓰이고, 이미 서 있으면 서버 레이어를 유지한다.
	 */
	@Operation(summary = "재생 선언",
			description = "재생할 musicId를 선언해 위치를 이동시킨다. 위치 이동의 유일한 원본이다. "
					+ "아직 지도에 없는 사용자는 layer로 첫 자리를 잡는다.")
	@PostMapping("/play")
	public ApiResponse<PlayResponse> play(@Valid @RequestBody PlayRequest request, Principal principal) {
		PlayResponse res = musicPlayService.play(
				requireEmail(principal), request.musicId(), request.source().name(), request.layer());
		return ApiResponse.success(res);
	}

	/** 재생 종료 — 실제 재생 시간(played_ms) 기록. 위치는 변하지 않는다. */
	@Operation(summary = "재생 종료", description = "실제 재생 시간(played_ms)을 기록한다. 위치는 변경되지 않는다.")
	@PatchMapping("/play/end")
	public ApiResponse<Void> playEnd(@Valid @RequestBody PlayEndRequest request, Principal principal) {
		musicPlayService.playEnd(requireEmail(principal), request.playHistoryId(), request.playedMs());
		return ApiResponse.success(null);
	}
}
