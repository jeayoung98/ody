package com.ssafy.backend.security;

import java.io.IOException;
import java.time.Duration;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

	private static final String REFRESH_TOKEN_KEY_PREFIX = "refresh:";
	private static final String EXCHANGE_CODE_KEY_PREFIX = "oauth:exchange:";
	private static final Duration EXCHANGE_CODE_TTL = Duration.ofSeconds(30);

	private final JwtTokenProvider jwtTokenProvider;
	private final StringRedisTemplate redisTemplate;

	@Value("${app.oauth.frontend-redirect-uri}")
	private String frontendRedirectUri;

	@Override
	public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
			Authentication authentication) throws IOException {

		CustomOAuth2User principal = (CustomOAuth2User) authentication.getPrincipal();
		String email = principal.getUser().getEmail();

		String accessToken = jwtTokenProvider.createAccessToken(email);
		String refreshToken = jwtTokenProvider.createRefreshToken(email);

		redisTemplate.opsForValue().set(
				REFRESH_TOKEN_KEY_PREFIX + email,
				refreshToken,
				Duration.ofMillis(jwtTokenProvider.getRefreshTokenExpirationMs()));

		// access token을 리다이렉트 URL에 그대로 노출하지 않기 위해 1회용 교환 코드만 발급한다.
		String exchangeCode = UUID.randomUUID().toString();
		redisTemplate.opsForValue().set(EXCHANGE_CODE_KEY_PREFIX + exchangeCode, accessToken, EXCHANGE_CODE_TTL);

		response.addHeader(HttpHeaders.SET_COOKIE,
				RefreshTokenCookie.issue(refreshToken, jwtTokenProvider.getRefreshTokenExpirationMs()));

		log.info("[OAuth2] 로그인 성공, email={} 교환코드 발급 완료", email);

		response.sendRedirect(frontendRedirectUri + "?code=" + exchangeCode);
	}
}
