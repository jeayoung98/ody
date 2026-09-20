package com.ssafy.backend.realtime.controller.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.dto.play.PlayEndRequest;
import com.ssafy.backend.realtime.dto.play.PlayRequest;
import com.ssafy.backend.realtime.dto.play.PlayResponse;
import com.ssafy.backend.realtime.dto.play.PlaySource;
import com.ssafy.backend.realtime.service.play.MusicPlayService;

/** 재생 선언·종료가 로그인 사용자 기준으로만 처리되는지 검증한다. */
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

	@Test
	@DisplayName("재생 종료는 토큰의 이메일로 처리한다")
	void playEndUsesPrincipalEmail() {
		controller.playEnd(new PlayEndRequest(501L, 183_000L), () -> EMAIL);

		verify(musicPlayService).playEnd(EMAIL, 501L, 183_000L);
	}

	// 아래 둘은 SecurityConfig 가 permitAll 인 동안만 의미가 있다 (컨트롤러 requireEmail 주석 참고).
	// authenticated() 로 원복하면 필터 체인이 먼저 막으므로 이 테스트도 함께 지운다.

	@Test
	@DisplayName("인증 없이 부른 재생 선언은 401 로 거부한다")
	void playWithoutPrincipalIsUnauthenticated() {
		assertThatThrownBy(() -> controller.play(new PlayRequest(8812L, PlaySource.MAP, 2), null))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(AuthErrorCode.UNAUTHENTICATED));

		verifyNoInteractions(musicPlayService);
	}

	@Test
	@DisplayName("인증 없이 부른 재생 종료는 401 로 거부한다")
	void playEndWithoutPrincipalIsUnauthenticated() {
		assertThatThrownBy(() -> controller.playEnd(new PlayEndRequest(501L, 183_000L), null))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(AuthErrorCode.UNAUTHENTICATED));

		verifyNoInteractions(musicPlayService);
	}
}
