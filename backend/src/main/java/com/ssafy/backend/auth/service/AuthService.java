package com.ssafy.backend.auth.service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.regex.Pattern;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.auth.dto.GoogleLoginResult;
import com.ssafy.backend.auth.dto.UserAuthDto;
import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.security.GoogleIdTokenVerifierPort;
import com.ssafy.backend.security.JwtTokenProvider;
import com.ssafy.backend.security.TokenPair;
import com.ssafy.backend.user.NicknamePolicy;

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

	/** 영문+숫자 포함 8자 이상. bcrypt는 UTF-8 72바이트를 넘으면 초과분을 조용히 버리므로 바이트 길이는 별도 검사한다. */
	private static final Pattern PASSWORD_PATTERN = Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d).{8,}$");
	private static final int PASSWORD_MAX_BYTES = 72;

	private final AuthMapper authMapper;
	private final JwtTokenProvider jwtTokenProvider;
	private final StringRedisTemplate redisTemplate;
	private final PasswordEncoder passwordEncoder;
	private final GoogleIdTokenVerifierPort googleIdTokenVerifierPort;

	/**
	 * 이메일/비밀번호 회원가입 (S15P21A405-121). AUTH-01 소셜 로그인 확정과 별개로 백엔드 판단 하에 추가한 경로.
	 * name 컬럼은 NOT NULL이라 구글 표시 이름 대신 nickname을 그대로 채운다.
	 */
	public TokenPair signup(String email, String rawPassword, String nickname) {
		if (!isValidPassword(rawPassword)) {
			throw new CustomException(AuthErrorCode.INVALID_PASSWORD_FORMAT);
		}
		if (!NicknamePolicy.isValidLength(nickname)) {
			throw new CustomException(AuthErrorCode.INVALID_NICKNAME_LENGTH);
		}
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
	 * 이메일/비밀번호 로그인. 이메일이 없거나 구글 OAuth 전용 계정(비밀번호 없음)이면 INVALID_CREDENTIALS,
	 * 이메일은 있는데 비밀번호만 틀리면 PASSWORD_MISMATCH로 구분한다(계정 존재 여부는 응답에 드러난다).
	 */
	public TokenPair login(String email, String rawPassword) {
		UserAuthDto user = authMapper.findByEmail(email);
		if (user == null || user.getPasswordHash() == null) {
			throw new CustomException(AuthErrorCode.INVALID_CREDENTIALS);
		}
		if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
			throw new CustomException(AuthErrorCode.PASSWORD_MISMATCH);
		}

		authMapper.touchLogin(email, user.getImageUrl());
		log.info("[Auth] 이메일 로그인 완료 email={}", email);
		return issueTokenPair(email);
	}

	/**
	 * 구글 idToken 로그인/가입 (S15P21A405-122, AUTH-01 본안). 서명 위조·audience 불일치·만료·
	 * email_verified=false는 전부 OAUTH_FAILED로 뭉뚱그린다.
	 */
	public GoogleLoginResult loginWithGoogleIdToken(String idToken) {
		GoogleIdTokenVerifierPort.GoogleIdentity identity = googleIdTokenVerifierPort.verify(idToken)
				.filter(GoogleIdTokenVerifierPort.GoogleIdentity::emailVerified)
				.orElseThrow(() -> new CustomException(AuthErrorCode.OAUTH_FAILED));

		UserAuthDto user = authMapper.findByEmail(identity.email());

		if (user == null) {
			user = new UserAuthDto();
			user.setEmail(identity.email());
			user.setName(identity.name());
			user.setImageUrl(identity.imageUrl());
			authMapper.insert(user);
			log.info("[Auth] 구글 idToken 신규 회원가입 완료 email={}", identity.email());
		} else {
			authMapper.touchLogin(identity.email(), identity.imageUrl());
			log.info("[Auth] 구글 idToken 로그인 완료 email={}", identity.email());
		}

		// 사용자가 올린 사진이 있으면 그것이 정본이다. touchLogin 은 image_url 이 비어 있을 때만 채운다
		// [S15P21A405-426].
		String imageUrl = user.getImageUrl() != null ? user.getImageUrl() : identity.imageUrl();

		TokenPair tokenPair = issueTokenPair(identity.email());
		GoogleLoginResult.UserInfo userInfo =
				new GoogleLoginResult.UserInfo(user.getEmail(), user.getName(), user.getNickname(), imageUrl);

		return new GoogleLoginResult(tokenPair, userInfo);
	}

	private boolean isValidPassword(String rawPassword) {
		return PASSWORD_PATTERN.matcher(rawPassword).matches()
				&& rawPassword.getBytes(StandardCharsets.UTF_8).length <= PASSWORD_MAX_BYTES;
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
