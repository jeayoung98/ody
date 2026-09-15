package com.ssafy.backend.feedback.controller;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.feedback.dto.FeedbackRequest;
import com.ssafy.backend.feedback.dto.FeedbackResponse;
import com.ssafy.backend.feedback.service.FeedbackService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/feedback")
@Tag(name = "Feedback", description = "주변·범위 탐색 설문 응답 저장")
public class FeedbackController {

	private final FeedbackService feedbackService;

	public FeedbackController(FeedbackService feedbackService) {
		this.feedbackService = feedbackService;
	}

	/** 곡 하나가 끝나거나 스킵될 때 1건 (정본 §5.1). 비로그인 허용 — 그때 user_email 은 NULL. */
	@Operation(summary = "주변·범위 탐색 설문 응답 저장", description = "곡 하나가 끝나거나 스킵될 때 피드백 1건을 저장한다. 비로그인도 허용하며, 이때 user_email은 NULL로 저장된다.")
	@PostMapping
	public ApiResponse<FeedbackResponse> save(
			@RequestBody @Valid FeedbackRequest request, Authentication authentication) {
		return ApiResponse.success(feedbackService.save(request, emailOf(authentication)));
	}

	private static String emailOf(Authentication authentication) {
		if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
			return null;
		}
		return authentication.getName();
	}
}
