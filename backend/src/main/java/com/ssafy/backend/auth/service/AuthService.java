package com.ssafy.backend.auth.service;

import java.time.Duration;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.auth.dto.UserAuthDto;
import com.ssafy.backend.auth.mapper.AuthMapper;
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

	private final AuthMapper authMapper;
	private final JwtTokenProvider jwtTokenProvider;
	private final StringRedisTemplate redisTemplate;
	private final PasswordEncoder passwordEncoder;

	/**
	 * 이메일/비밀번호 회원가입 (S15P21A405-121). AUTH-01 소셜 로그인 확정과 별개로 백엔드 판단 하에 추가한 경로.
	 * name 컬럼은 NOT NULL이라 구글 표시 이름 대신 nickname을 그대로 채운다.
	 */
	public TokenPair signup(String email, String rawPassword, String nickname) {
		if (authMapper.findByEmail(email) != null) {
			throw new CustomException(AuthErrorCode.EMAIL_ALREADY_EXISTS);
		}
		if (authMapper.existsByNickname(nickname)) {
			throw new CustomException(AuthErrorCode.NICKNAME_ALREADY_EXISTS);
		}

		UserAuthDto user = new UserAuthDto();
		user.setEmail(email);
		user.setName(nickname);
		user.setNickname(nickname);
		user.setPasswordHash(passwordEncoder.encode(rawPassword));
		authMapper.insert(user);

		log.info("[Auth] 이메일 회원가입 완료 email={}", email);
		return issueTokenPair(email);
	}

	/**
	 * 이메일/비밀번호 로그인. 이메일이 없거나, 구글 OAuth로만 가입해 비밀번호가 없거나, 비밀번호가 틀린 경우
	 * 전부 동일한 INVALID_CREDENTIALS로 응답해 계정 존재 여부가 드러나지 않게 한다.
	 */
	public TokenPair login(String email, String rawPassword) {
		UserAuthDto user = authMapper.findByEmail(email);
		if (user == null || user.getPasswordHash() == null
				|| !passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
			throw new CustomException(AuthErrorCode.INVALID_CREDENTIALS);
		}

		authMapper.touchLogin(email, user.getImageUrl());
		log.info("[Auth] 이메일 로그인 완료 email={}", email);
		return issueTokenPair(email);
	}

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

		TokenPair tokenPair = issueTokenPair(email);
		log.info("[Auth] access token 재발급 완료 email={}", email);

		return tokenPair;
	}

	private TokenPair issueTokenPair(String email) {
		String accessToken = jwtTokenProvider.createAccessToken(email);
		String refreshToken = jwtTokenProvider.createRefreshToken(email);

		redisTemplate.opsForValue().set(
				REFRESH_TOKEN_KEY_PREFIX + email,
				refreshToken,
				Duration.ofMillis(jwtTokenProvider.getRefreshTokenExpirationMs()));

		return new TokenPair(accessToken, refreshToken);
	}

	public void logout(String email, String accessTokenJti, long remainingMillis) {
		blacklistAccessToken(accessTokenJti, remainingMillis);
		redisTemplate.delete(REFRESH_TOKEN_KEY_PREFIX + email);
		log.info("[Auth] 로그아웃 완료 email={}", email);
	}

	public void withdraw(String email, String accessTokenJti, long remainingMillis) {
		blacklistAccessToken(accessTokenJti, remainingMillis);
		redisTemplate.delete(REFRESH_TOKEN_KEY_PREFIX + email);
		authMapper.deleteByEmail(email);
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
