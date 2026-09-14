package com.ssafy.backend.realtime.play.dto;

import jakarta.validation.constraints.NotNull;

/**
 * POST /music/play 요청. 좌표는 보내지 않는다 — 서버가 musicId 로 계산(위치 조작 방지).
 * source 범위 밖/타입 오류는 역직렬화 단계에서 400(VALIDATION_ERROR).
 */
public record PlayRequest(
		@NotNull Long musicId,
		@NotNull PlaySource source) {
}
