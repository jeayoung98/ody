package com.ssafy.backend.report.controller;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.report.dto.MusicReportRequest;
import com.ssafy.backend.report.dto.MusicReportResponse;
import com.ssafy.backend.report.service.MusicReportService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/music/report")
@Tag(name = "MusicReport", description = "음원 신고 저장")
public class MusicReportController {

    private final MusicReportService musicReportService;

    public MusicReportController(MusicReportService musicReportService) {
        this.musicReportService = musicReportService;
    }

    /** 곡 하나를 신고. 비로그인 허용 — 이때 user_email 은 NULL. */
    @Operation(summary = "음원 신고", description = "곡 하나를 신고 사유(spoken|noise|other)와 함께 저장한다. "
            + "비로그인도 허용하며, 이때 user_email은 NULL로 저장된다. 없는 곡이면 404 MUSIC_NOT_FOUND.")
    @PostMapping
    public ApiResponse<MusicReportResponse> report(
            @RequestBody @Valid MusicReportRequest request, Authentication authentication) {
        return ApiResponse.success(musicReportService.report(request, emailOf(authentication)));
    }

    private static String emailOf(Authentication authentication) {
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return authentication.getName();
    }
}
