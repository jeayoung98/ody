package com.ssafy.backend.auth.dto;

/**
 * POST /api/auth/login/google 응답 (정본 §1.1 본안). refreshToken은 body에 넣지 않고
 * httpOnly 쿠키로만 내려간다 — exchange/reissue와 동일한 컨벤션.
 */
public record GoogleLoginResponseDto(
		String accessToken,
		GoogleLoginResult.UserInfo user) {
}
