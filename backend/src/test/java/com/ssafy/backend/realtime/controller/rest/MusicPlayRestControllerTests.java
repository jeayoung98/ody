package com.ssafy.backend.realtime.controller.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.realtime.dto.play.PlayRequest;
import com.ssafy.backend.realtime.dto.play.PlayResponse;
import com.ssafy.backend.realtime.dto.play.PlaySource;
import com.ssafy.backend.realtime.service.play.MusicPlayService;

/** 재생 선언이 로그인 사용자 기준으로만 처리되는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class MusicPlayRestControllerTests {

	private static final String EMAIL = "user@x.com";

	@Mock MusicPlayService musicPlayService;
	@InjectMocks MusicPlayRestController controller;

	@Test
	@DisplayName("재생 선언은 토큰의 이메일로 처리한다")
	void playUsesPrincipalEmail() {
		PlayResponse response = new PlayResponse(501L, 8812L, 2, 0.37, 1.24, 6, 12);
		when(musicPlayService.play(EMAIL, 8812L, "MAP", 2)).thenReturn(response);

		ApiResponse<PlayResponse> result = controller.play(
				new PlayRequest(8812L, PlaySource.MAP, 2), () -> EMAIL);

		assertThat(result.data()).isEqualTo(response);
	}

	// 인증 없이 부른 경우는 여기서 보지 않는다. 필터 체인이 먼저 401 을 내주므로
	// 컨트롤러까지 오지 않는다. 그 검증은 SecurityPolicyTests 가 필터 체인째로 한다.
}
