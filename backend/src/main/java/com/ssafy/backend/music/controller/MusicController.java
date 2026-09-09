package com.ssafy.backend.music.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.music.dto.MusicDetailResponse;
import com.ssafy.backend.music.service.MusicService;

import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/music")
@Validated
public class MusicController {

	private final MusicService musicService;

	public MusicController(MusicService musicService) {
		this.musicService = musicService;
	}

	/**
	 * 노래 상세 조회 (정본 §3.2). id로 상세 + 최근접 10곡(neighbors). 없는 곡 → 404 MUSIC_NOT_FOUND.
	 */
	@GetMapping("/detail")
	public ApiResponse<MusicDetailResponse> detail(@RequestParam @Min(1) long id) {
		return ApiResponse.success(musicService.getDetail(id));
	}
}
