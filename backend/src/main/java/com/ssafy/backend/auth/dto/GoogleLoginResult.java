package com.ssafy.backend.auth.dto;

import com.ssafy.backend.security.TokenPair;

/**
 * AuthService.loginWithGoogleIdToken의 서비스 계층 결과. tokenPair는 컨트롤러가 refreshToken을
 * httpOnly 쿠키로 내려보내는 데만 쓰고, 실제 JSON 응답(GoogleLoginResponseDto)에는 accessToken만 넣는다.
 */
public record GoogleLoginResult(TokenPair tokenPair, UserInfo user) {

	public record UserInfo(String email, String name, String nickname, String imageUrl) {
	}
}
