package com.ssafy.backend.feedback.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.feedback.dto.AnsweredRow;
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

	/** 곡 하나를 떠날 때 1건 (정본 §5.1). 비로그인 허용 — 그때 user_email 은 NULL. */
	@Operation(summary = "주변·범위 탐색 설문 응답 저장", description = "곡 하나를 떠날 때 피드백 1건을 저장한다. 비로그인도 허용하며, 이때 user_email은 NULL로 저장된다. "
			+ "같은 사람(로그인 이메일 또는 anonymousId)이 같은 문항에 이미 답했으면 저장하지 않고 기존 feedbackId를 돌려준다.")
	@PostMapping
	public ApiResponse<FeedbackResponse> save(
			@RequestBody @Valid FeedbackRequest request, Authentication authentication) {
		return ApiResponse.success(feedbackService.save(request, emailOf(authentication)));
	}

	/** FE 가 이미 답한 곡에 설문을 다시 띄우지 않기 위한 조회 (정본 §5.2). */
	@Operation(summary = "이미 답한 설문 문항 조회", description = "로그인 이메일 또는 anonymousId 기준으로 답한 문항(mode, anchorMusicId, prevMusicId, musicId, verdict)을 돌려준다. 둘 다 없으면 400.")
	@GetMapping("/answered")
	public ApiResponse<List<AnsweredRow>> answered(
			@RequestParam(required = false) UUID anonymousId, Authentication authentication) {
		return ApiResponse.success(feedbackService.answered(
				emailOf(authentication), anonymousId == null ? null : anonymousId.toString()));
	}

	private static String emailOf(Authentication authentication) {
		if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
			return null;
		}
		return authentication.getName();
	}
}
