package com.ssafy.backend.auth.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.auth.dto.ExchangeRequestDto;
import com.ssafy.backend.auth.dto.GoogleLoginRequestDto;
import com.ssafy.backend.auth.dto.GoogleLoginResponseDto;
import com.ssafy.backend.auth.dto.GoogleLoginResult;
import com.ssafy.backend.auth.dto.LoginRequestDto;
import com.ssafy.backend.auth.dto.SignupRequestDto;
import com.ssafy.backend.auth.dto.TokenResponseDto;
import com.ssafy.backend.security.JwtTokenProvider;
import com.ssafy.backend.security.RefreshTokenCookie;
import com.ssafy.backend.security.TokenPair;
import com.ssafy.backend.auth.service.AuthService;

import io.jsonwebtoken.Claims;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

	private static final String REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

	private final AuthService authService;
	private final JwtTokenProvider jwtTokenProvider;

	// 이메일/비밀번호 회원가입 (S15P21A405-121). 응답 모양은 exchange/reissue와 동일.
	@PostMapping("/signup")
	public ApiResponse<TokenResponseDto> signup(
			@RequestBody @Valid SignupRequestDto request, HttpServletResponse response) {

		TokenPair tokenPair = authService.signup(request.email(), request.password(), request.nickname());
		response.addHeader(HttpHeaders.SET_COOKIE,
				RefreshTokenCookie.issue(tokenPair.refreshToken(), jwtTokenProvider.getRefreshTokenExpirationMs()));

		return ApiResponse.success(new TokenResponseDto(tokenPair.accessToken()));
	}

	// 이메일/비밀번호 로그인 (S15P21A405-121).
	@PostMapping("/login")
	public ApiResponse<TokenResponseDto> login(
			@RequestBody @Valid LoginRequestDto request, HttpServletResponse response) {

		TokenPair tokenPair = authService.login(request.email(), request.password());
		response.addHeader(HttpHeaders.SET_COOKIE,
				RefreshTokenCookie.issue(tokenPair.refreshToken(), jwtTokenProvider.getRefreshTokenExpirationMs()));

		return ApiResponse.success(new TokenResponseDto(tokenPair.accessToken()));
	}

	// 구글 idToken 로그인 (S15P21A405-122, AUTH-01 본안). Google Identity Services가 발급한 idToken을 검증.
	@PostMapping("/login/google")
	public ApiResponse<GoogleLoginResponseDto> loginWithGoogle(
			@RequestBody @Valid GoogleLoginRequestDto request, HttpServletResponse response) {

		GoogleLoginResult result = authService.loginWithGoogleIdToken(request.idToken());
		response.addHeader(HttpHeaders.SET_COOKIE,
				RefreshTokenCookie.issue(result.tokenPair().refreshToken(), jwtTokenProvider.getRefreshTokenExpirationMs()));

		return ApiResponse.success(new GoogleLoginResponseDto(
				result.tokenPair().accessToken(), result.isNewUser(), result.user()));
	}

	// 프론트가 OAuth 리다이렉트에서 받은 1회용 code를 실제 access token으로 교환한다.
	@PostMapping("/exchange")
	public ApiResponse<TokenResponseDto> exchange(@RequestBody ExchangeRequestDto request) {
		String accessToken = authService.exchangeCode(request.code());
		return ApiResponse.success(new TokenResponseDto(accessToken));
	}

	// access token 만료 시 refresh token 쿠키로 새 access token을 재발급한다.
	@PostMapping("/reissue")
	public ApiResponse<TokenResponseDto> reissue(
			@CookieValue(name = REFRESH_TOKEN_COOKIE_NAME, required = false) String refreshToken,
			HttpServletResponse response) {

		if (refreshToken == null) {
			throw new CustomException(AuthErrorCode.REFRESH_TOKEN_NOT_FOUND);
		}

		TokenPair tokenPair = authService.reissue(refreshToken);
		response.addHeader(HttpHeaders.SET_COOKIE,
				RefreshTokenCookie.issue(tokenPair.refreshToken(), jwtTokenProvider.getRefreshTokenExpirationMs()));

		return ApiResponse.success(new TokenResponseDto(tokenPair.accessToken()));
	}

	@PostMapping("/logout")
	public ApiResponse<Void> logout(HttpServletRequest request, HttpServletResponse response) {
		Claims claims = resolveClaims(request);
		String email = claims.getSubject();

		authService.logout(email, claims.getId(), jwtTokenProvider.getRemainingMillis(claims));
		response.addHeader(HttpHeaders.SET_COOKIE, RefreshTokenCookie.clear());

		return ApiResponse.success(null);
	}

	@PostMapping("/withdraw")
	public ApiResponse<Void> withdraw(HttpServletRequest request, HttpServletResponse response) {
		Claims claims = resolveClaims(request);
		String email = claims.getSubject();

		authService.withdraw(email, claims.getId(), jwtTokenProvider.getRemainingMillis(claims));
		response.addHeader(HttpHeaders.SET_COOKIE, RefreshTokenCookie.clear());

		return ApiResponse.success(null);
	}

	private Claims resolveClaims(HttpServletRequest request) {
		String token = jwtTokenProvider.resolveToken(request);
		if (token == null) {
			throw new CustomException(AuthErrorCode.UNAUTHENTICATED);
		}
		return jwtTokenProvider.parseClaims(token);
	}
}
