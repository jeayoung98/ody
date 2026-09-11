package com.ssafy.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.ssafy.backend.auth.dto.GoogleLoginResult;
import com.ssafy.backend.auth.dto.UserAuthDto;
import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.auth.service.AuthService;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.security.GoogleIdTokenVerifierPort;
import com.ssafy.backend.security.GoogleIdTokenVerifierPort.GoogleIdentity;
import com.ssafy.backend.security.JwtTokenProvider;

/**
 * 구글 idToken 로그인 서비스 유닛 (S15P21A405-122, AUTH-01 본안). GoogleIdTokenVerifierPort는 mock —
 * 실제 서명 검증은 GoogleIdTokenVerifierAdapter가 Google 라이브러리에 위임하므로 여기선 계약만 검증한다.
 */
class AuthGoogleLoginServiceTests {

	private static final String TEST_JWT_SECRET =
			"unit-test-only-secret-key-must-be-long-enough-for-hmac-sha256-signing";

	private final AuthMapper authMapper = mock(AuthMapper.class);
	private final StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
	@SuppressWarnings("unchecked")
	private final ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
	private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
	private final JwtTokenProvider jwtTokenProvider =
			new JwtTokenProvider(TEST_JWT_SECRET, 1_800_000L, 1_209_600_000L);
	private final GoogleIdTokenVerifierPort googleIdTokenVerifierPort = mock(GoogleIdTokenVerifierPort.class);

	private final AuthService authService = new AuthService(
			authMapper, jwtTokenProvider, redisTemplate, passwordEncoder, googleIdTokenVerifierPort);

	private void stubRedis() {
		when(redisTemplate.opsForValue()).thenReturn(valueOperations);
	}

	@Test
	void loginWithGoogleIdToken_newUser_createsAccount() {
		stubRedis();
		when(googleIdTokenVerifierPort.verify("valid-token")).thenReturn(
				Optional.of(new GoogleIdentity("new@gmail.com", true, "홍길동", "https://lh3.example/pic.png")));
		when(authMapper.findByEmail("new@gmail.com")).thenReturn(null);

		GoogleLoginResult result = authService.loginWithGoogleIdToken("valid-token");

		assertThat(result.user().email()).isEqualTo("new@gmail.com");
		assertThat(result.user().name()).isEqualTo("홍길동");
		assertThat(result.user().nickname()).isNull();
		assertThat(jwtTokenProvider.parseClaims(result.tokenPair().accessToken()).getSubject())
				.isEqualTo("new@gmail.com");

		ArgumentCaptor<UserAuthDto> captor = ArgumentCaptor.forClass(UserAuthDto.class);
		verify(authMapper).insert(captor.capture());
		assertThat(captor.getValue().getName()).isEqualTo("홍길동");
		assertThat(captor.getValue().getImageUrl()).isEqualTo("https://lh3.example/pic.png");
	}

	@Test
	void loginWithGoogleIdToken_existingUser_touchesLoginAndReturnsProfile() {
		stubRedis();
		when(googleIdTokenVerifierPort.verify("valid-token")).thenReturn(
				Optional.of(new GoogleIdentity("me@gmail.com", true, "홍길동", "https://lh3.example/new.png")));
		UserAuthDto existing = new UserAuthDto();
		existing.setEmail("me@gmail.com");
		existing.setName("홍길동");
		existing.setNickname("길동무");
		when(authMapper.findByEmail("me@gmail.com")).thenReturn(existing);

		GoogleLoginResult result = authService.loginWithGoogleIdToken("valid-token");

		assertThat(result.user().nickname()).isEqualTo("길동무");
		verify(authMapper).touchLogin("me@gmail.com", "https://lh3.example/new.png");
		verify(authMapper, never()).insert(any());
	}

	@Test
	void loginWithGoogleIdToken_verificationFails_throwsOauthFailed() {
		when(googleIdTokenVerifierPort.verify("bad-token")).thenReturn(Optional.empty());

		assertThatThrownBy(() -> authService.loginWithGoogleIdToken("bad-token"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.OAUTH_FAILED);

		verify(authMapper, never()).findByEmail(any());
	}

	@Test
	void loginWithGoogleIdToken_emailNotVerified_throwsOauthFailed() {
		when(googleIdTokenVerifierPort.verify("unverified-token")).thenReturn(
				Optional.of(new GoogleIdentity("new@gmail.com", false, "홍길동", null)));

		assertThatThrownBy(() -> authService.loginWithGoogleIdToken("unverified-token"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.OAUTH_FAILED);
	}
}
