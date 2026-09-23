package com.ssafy.backend.realtime.controller.rest;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.realtime.dto.reaction.ReactionRequest;
import com.ssafy.backend.realtime.service.reaction.ReactionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 반응 REST (SOCIAL-02). 소켓이 아니라 REST 인 이유는 따라가기와 같다 —
 * 거부 사유(다른 층·쿨다운)가 보낸 사람에게 보여야 한다.
 *
 * realtime 프로파일에서만 뜬다.
 */
@RestController
@RequestMapping("/api/realtime")
@Profile("realtime")
@Validated
@RequiredArgsConstructor
@Tag(name = "Reaction", description = "반응하기 - 같은 층의 사용자에게 이모지를 보낸다")
public class ReactionRestController {

	private final ReactionService reactionService;

	/** 반응 전송. 받는 사람 개인 큐로 REACTION 이 한 번 나간다. */
	@Operation(summary = "반응 보내기",
			description = "같은 층에 있는 사용자에게 이모지 반응을 보낸다. "
					+ "자기 자신, 다른 층·미접속 사용자, 같은 사용자에게 연속 전송은 거부한다.")
	@PostMapping("/reactions")
	public ApiResponse<Void> send(@Valid @RequestBody ReactionRequest request, Principal principal) {
		reactionService.send(principal.getName(), request);
		return ApiResponse.success(null);
	}
}
