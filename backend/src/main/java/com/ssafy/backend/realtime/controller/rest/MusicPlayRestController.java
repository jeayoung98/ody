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
	 * 재생 선언 = 위치 이동의 유일한 원본. musicId 로 서버가 좌표를 계산한다.
	 * layer 는 처음 자리를 잡을 때만 쓰이고, 이미 서 있으면 서버 레이어를 유지한다.
	 */
	@Operation(summary = "재생 선언",
			description = "재생할 musicId를 선언해 위치를 이동시킨다. 위치 이동의 유일한 원본이다. "
					+ "아직 지도에 없는 사용자는 layer로 첫 자리를 잡는다.")
	@PostMapping("/play")
	public ApiResponse<PlayResponse> play(@Valid @RequestBody PlayRequest request, Principal principal) {
		PlayResponse res = musicPlayService.play(
				principal.getName(), request.musicId(), request.source().name(), request.layer());
		return ApiResponse.success(res);
	}

	/** 재생 종료 — 실제 재생 시간(played_ms) 기록. 위치는 변하지 않는다. */
	@Operation(summary = "재생 종료", description = "실제 재생 시간(played_ms)을 기록한다. 위치는 변경되지 않는다.")
	@PatchMapping("/play/end")
	public ApiResponse<Void> playEnd(@Valid @RequestBody PlayEndRequest request, Principal principal) {
		musicPlayService.playEnd(principal.getName(), request.playHistoryId(), request.playedMs());
		return ApiResponse.success(null);
	}
}
