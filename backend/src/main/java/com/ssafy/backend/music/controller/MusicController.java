package com.ssafy.backend.music.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.music.dto.MajorResponse;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.PageResponse;
import com.ssafy.backend.music.service.MusicService;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import com.ssafy.backend.music.dto.MusicDetailResponse;

@RestController
@RequestMapping("/api/music")
@Validated
public class MusicController {

	private final MusicService musicService;

	public MusicController(MusicService musicService) {
		this.musicService = musicService;
	}

	/**
	 * 대표곡 조회 (정본 §3.4). level=1은 PC 값 없이 호출 가능.
	 */
	@GetMapping("/major")
	public ApiResponse<MajorResponse> major(
			@RequestParam(defaultValue = "1") @Min(1) int level,
			@RequestParam(required = false) Double pc1,
			@RequestParam(required = false) Double pc2,
			@RequestParam(required = false) Double pc3,
			@RequestParam(required = false) Double pc4,
			@RequestParam(required = false) Double pc5,
			@RequestParam(required = false) Double pc6,
			@RequestParam(required = false) Double pc7,
			@RequestParam(required = false) Double pc8,
			@RequestParam(required = false) Double pc9,
			@RequestParam(required = false) Double pc10,
			@RequestParam(required = false) Double pc11,
			@RequestParam(required = false) Double pc12,
			@RequestParam(required = false) Double pc13,
			@RequestParam(required = false) Double pc14,
			@RequestParam(required = false) Double pc15,
			@RequestParam(required = false) Double pc16) {

		Double[] center = { pc1, pc2, pc3, pc4, pc5, pc6, pc7, pc8,
				pc9, pc10, pc11, pc12, pc13, pc14, pc15, pc16 };
		return ApiResponse.success(musicService.getMajor(level, center));
	}

	/**
	 * 노래 검색 (정본 §3.1). query 부분일치, page 0-based. 결과 없음은 빈 content + 200.
	 */
	@GetMapping("/search")
	public ApiResponse<PageResponse<MusicSummary>> search(
			@RequestParam @NotBlank String query,
			@RequestParam @Min(0) int page) {
		return ApiResponse.success(musicService.search(query, page));
	}

	/**
	 * 노래 상세 조회 (정본 §3.2). id로 상세 + 최근접 10곡(neighbors). 없는 곡 → 404 MUSIC_NOT_FOUND.
	 */
	@GetMapping("/detail")
	public ApiResponse<MusicDetailResponse> detail(@RequestParam @Min(1) long id) {
		return ApiResponse.success(musicService.getDetail(id));
	}
}
