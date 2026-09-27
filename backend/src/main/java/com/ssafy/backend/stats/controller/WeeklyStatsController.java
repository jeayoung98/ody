package com.ssafy.backend.stats.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.stats.dto.WeeklyStatsResponse;
import com.ssafy.backend.stats.service.WeeklyStatsService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;

/**
 * 주간 랭킹 (S15P21A405-448). 누구의 랭킹인지가 아니라 전체 집계라서 파라미터가 없다.
 */
@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
@Tag(name = "Stats", description = "주간 랭킹")
public class WeeklyStatsController {

	private final WeeklyStatsService weeklyStatsService;

	@Operation(summary = "이번 주 랭킹",
			description = "한국 시간 월요일 00:00 부터 이번 주 발견왕·탐험왕·기여도 top 10 을 한 번에 조회한다.")
	@GetMapping("/weekly")
	public ApiResponse<WeeklyStatsResponse> weekly() {
		return ApiResponse.success(weeklyStatsService.weekly());
	}
}
