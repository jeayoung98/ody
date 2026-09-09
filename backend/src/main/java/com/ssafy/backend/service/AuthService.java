package com.ssafy.backend.service;

import java.time.Duration;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.mapper.UserMapper;
import com.ssafy.backend.security.JwtTokenProvider;
import com.ssafy.backend.security.TokenPair;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

	private static final String REFRESH_TOKEN_KEY_PREFIX = "refresh:";
	private static final String BLACKLIST_KEY_PREFIX = "blacklist:";
	private static final String EXCHANGE_CODE_KEY_PREFIX = "oauth:exchange:";

	private final UserMapper userMapper;
	private final JwtTokenProvider jwtTokenProvider;
	private final StringRedisTemplate redisTemplate;

	public String exchangeCode(String code) {
		String key = EXCHANGE_CODE_KEY_PREFIX + code;
		String accessToken = redisTemplate.opsForValue().get(key);

		if (accessToken == null) {
			log.warn("[Auth] 유효하지 않거나 만료된 교환 코드 요청");
			throw new CustomException(AuthErrorCode.INVALID_EXCHANGE_CODE);
		}

		redisTemplate.delete(key);
		log.info("[Auth] 교환 코드로 access token 발급 완료");

		return accessToken;
	}

	public TokenPair reissue(String refreshToken) {
		Claims claims;
		try {
			claims = jwtTokenProvider.parseClaims(refreshToken);
		} catch (JwtException | IllegalArgumentException e) {
			log.warn("[Auth] refresh token 파싱 실패: {}", e.getMessage());
			throw new CustomException(AuthErrorCode.INVALID_TOKEN);
		}

		if (!jwtTokenProvider.isRefreshToken(claims)) {
			throw new CustomException(AuthErrorCode.INVALID_TOKEN);
		}

		String email = claims.getSubject();
		String savedRefreshToken = redisTemplate.opsForValue().get(REFRESH_TOKEN_KEY_PREFIX + email);

		if (savedRefreshToken == null || !savedRefreshToken.equals(refreshToken)) {
			// 저장된 값과 다르면 탈취/재사용된 refresh token일 수 있으므로 즉시 폐기하고 재로그인을 요구한다.
			redisTemplate.delete(REFRESH_TOKEN_KEY_PREFIX + email);
			log.warn("[Auth] refresh token 불일치 감지, email={}", email);
			throw new CustomException(AuthErrorCode.REFRESH_TOKEN_MISMATCH);
		}

		String newAccessToken = jwtTokenProvider.createAccessToken(email);
		String newRefreshToken = jwtTokenProvider.createRefreshToken(email);

		redisTemplate.opsForValue().set(
				REFRESH_TOKEN_KEY_PREFIX + email,
				newRefreshToken,
				Duration.ofMillis(jwtTokenProvider.getRefreshTokenExpirationMs()));

		log.info("[Auth] access token 재발급 완료 email={}", email);

		return new TokenPair(newAccessToken, newRefreshToken);
	}

	public void logout(String email, String accessTokenJti, long remainingMillis) {
		blacklistAccessToken(accessTokenJti, remainingMillis);
		redisTemplate.delete(REFRESH_TOKEN_KEY_PREFIX + email);
		log.info("[Auth] 로그아웃 완료 email={}", email);
	}

	public void withdraw(String email, String accessTokenJti, long remainingMillis) {
		blacklistAccessToken(accessTokenJti, remainingMillis);
		redisTemplate.delete(REFRESH_TOKEN_KEY_PREFIX + email);
		userMapper.deleteByEmail(email);
		log.info("[Auth] 회원 탈퇴로 인한 하드 삭제 완료 email={}", email);
	}

	private void blacklistAccessToken(String jti, long remainingMillis) {
		if (remainingMillis > 0) {
			redisTemplate.opsForValue().set(
					BLACKLIST_KEY_PREFIX + jti,
					"true",
					Duration.ofMillis(remainingMillis));
		}
	}
}
