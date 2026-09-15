package com.ssafy.backend.realtime.play;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.realtime.play.dto.PlayEndRequest;
import com.ssafy.backend.realtime.play.dto.PlayRequest;
import com.ssafy.backend.realtime.play.dto.PlayResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 재생 선언·종료 REST (RT-02, S15P21A405-272). 본인 대상 API — email 은 토큰 subject(Principal).
 * realtime 프로파일에서만 활성 — 데모(무로그인)에선 미로드.
 * 실제 인증되려면 SecurityConfig 에서 /api/music/play* 를 authenticated() 로 올려야 함(현재 permitAll).
 *    → 테스트 시 토글, push 전 원복. permitAll 상태로 호출하면 principal=null.
 */
@RestController
@RequestMapping("/api/music")
@Profile("realtime")
@Validated
@RequiredArgsConstructor
@Tag(name = "MusicPlay", description = "재생 선언·종료 (실시간 위치 이동)")
public class MusicPlayController {

	private final PlayDeclarationService playDeclarationService;

	/** 재생 선언 = 위치 이동의 유일한 원본. musicId 로 서버가 좌표를 계산한다. */
	@Operation(summary = "재생 선언", description = "재생할 musicId를 선언해 위치를 이동시킨다. 위치 이동의 유일한 원본이다.")
	@PostMapping("/play")
	public ApiResponse<PlayResponse> play(@Valid @RequestBody PlayRequest request, Principal principal) {
		PlayResponse res = playDeclarationService.play(
				principal.getName(), request.musicId(), request.source().name());
		return ApiResponse.success(res);
	}

	/** 재생 종료 — 실제 재생 시간(played_ms) 기록. 위치는 변하지 않는다. */
	@Operation(summary = "재생 종료", description = "실제 재생 시간(played_ms)을 기록한다. 위치는 변경되지 않는다.")
	@PatchMapping("/play/end")
	public ApiResponse<Void> playEnd(@Valid @RequestBody PlayEndRequest request, Principal principal) {
		playDeclarationService.playEnd(principal.getName(), request.playHistoryId(), request.playedMs());
		return ApiResponse.success(null);
	}
}
