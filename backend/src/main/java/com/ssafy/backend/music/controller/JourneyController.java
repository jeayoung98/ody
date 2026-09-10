package com.ssafy.backend.music.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.music.dto.JourneyResponse;
import com.ssafy.backend.music.service.JourneyService;

import jakarta.validation.constraints.Min;

/**
 * 경로 탐색 (정본 §3.3). URL 은 {@code /music} 아래지만 컨트롤러를 MusicController 와 분리했다.
 *
 * <p>MusicController 에 의존성을 더하면 그 컨트롤러의 슬라이스 테스트(major·search·detail)가
 * 전부 새 빈을 요구하며 깨진다 — 실제로 깨졌다. 엔드포인트가 늘어날 때마다 남의 기능 테스트를
 * 고쳐야 하므로 여정은 별도 컨트롤러로 둔다. 경로·응답 계약은 정본 그대로다.
 */
@RestController
@RequestMapping("/music")
@Validated
public class JourneyController {

	private final JourneyService journeyService;

	public JourneyController(JourneyService journeyService) {
		this.journeyService = journeyService;
	}

	/**
	 * 경로 탐색 (정본 §3.3). 두 곡을 잇는 순서 있는 곡 목록.
	 * 없는 곡 → 404 MUSIC_NOT_FOUND, 경로 없음 → 422 PATH_NOT_FOUND,
	 * 엔진 부재·타임아웃 → 500 INTERNAL_SERVER_ERROR.
	 *
	 * <p>{@code mode}·{@code n}·detour 파라미터는 받지 않는다 — 정본 §3.3 에 없고, 산출 방식과
	 * 정거장 수는 BE4 엔진이 정한다(FR-011, FR-023).
	 */
	@GetMapping("/journey")
	public ApiResponse<JourneyResponse> journey(
			@RequestParam @Min(1) long start,
			@RequestParam @Min(1) long end) {
		return ApiResponse.success(journeyService.getJourney(start, end));
	}
}
