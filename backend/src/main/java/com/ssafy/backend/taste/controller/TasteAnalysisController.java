package com.ssafy.backend.taste.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.taste.dto.TasteAnalysisResponse;
import com.ssafy.backend.taste.service.TasteAnalysisQueryService;
import com.ssafy.backend.taste.service.TasteAnalysisGenerationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/taste-analysis")
@RequiredArgsConstructor
public class TasteAnalysisController {

    private final TasteAnalysisQueryService queryService;
    private final TasteAnalysisGenerationService generationService;

    @GetMapping
    public ApiResponse<TasteAnalysisResponse> get(Authentication authentication) {
        return ApiResponse.success(queryService.get(authentication.getName()));
    }

    @PostMapping
    public ApiResponse<TasteAnalysisResponse> generate(Authentication authentication) {
        return ApiResponse.success(generationService.generate(authentication.getName()));
    }
}
