package com.ssafy.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.ssafy.backend.auth.dto.UserAuthDto;
import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.auth.service.AuthService;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.security.JwtTokenProvider;
import com.ssafy.backend.security.TokenPair;

/**
 * 이메일/비밀번호 회원가입·로그인 서비스 유닛 (S15P21A405-121). mock mapper/redis, 실제 JWT·bcrypt 사용.
 */
class AuthEmailServiceTests {

	private static final String TEST_JWT_SECRET =
			"unit-test-only-secret-key-must-be-long-enough-for-hmac-sha256-signing";

	private final AuthMapper authMapper = mock(AuthMapper.class);
	private final StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
	@SuppressWarnings("unchecked")
	private final ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
	private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
	private final JwtTokenProvider jwtTokenProvider =
			new JwtTokenProvider(TEST_JWT_SECRET, 1_800_000L, 1_209_600_000L);

	private final AuthService authService =
			new AuthService(authMapper, jwtTokenProvider, redisTemplate, passwordEncoder);

	private void stubRedis() {
		when(redisTemplate.opsForValue()).thenReturn(valueOperations);
	}

	@Test
	void signup_success_hashesPasswordAndReturnsTokenPair() {
		stubRedis();
		when(authMapper.findByEmail("new@gmail.com")).thenReturn(null);
		when(authMapper.existsByNickname("새유저")).thenReturn(false);

		TokenPair tokenPair = authService.signup("new@gmail.com", "password1234", "새유저");

		assertThat(tokenPair.accessToken()).isNotBlank();
		assertThat(tokenPair.refreshToken()).isNotBlank();
		assertThat(jwtTokenProvider.parseClaims(tokenPair.accessToken()).getSubject()).isEqualTo("new@gmail.com");

		ArgumentCaptor<UserAuthDto> captor = ArgumentCaptor.forClass(UserAuthDto.class);
		verify(authMapper).insert(captor.capture());
		UserAuthDto inserted = captor.getValue();
		assertThat(inserted.getEmail()).isEqualTo("new@gmail.com");
		assertThat(inserted.getName()).isEqualTo("새유저");
		assertThat(inserted.getNickname()).isEqualTo("새유저");
		assertThat(inserted.getPasswordHash()).isNotEqualTo("password1234");
		assertThat(passwordEncoder.matches("password1234", inserted.getPasswordHash())).isTrue();
	}

	@Test
	void signup_duplicateEmail_throwsEmailAlreadyExists() {
		UserAuthDto existing = new UserAuthDto();
		existing.setEmail("dup@gmail.com");
		when(authMapper.findByEmail("dup@gmail.com")).thenReturn(existing);

		assertThatThrownBy(() -> authService.signup("dup@gmail.com", "password1234", "닉네임"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.EMAIL_ALREADY_EXISTS);

		verify(authMapper, never()).insert(any());
	}

	@Test
	void signup_duplicateNickname_throwsNicknameAlreadyExists() {
		when(authMapper.findByEmail("new@gmail.com")).thenReturn(null);
		when(authMapper.existsByNickname("중복닉")).thenReturn(true);

		assertThatThrownBy(() -> authService.signup("new@gmail.com", "password1234", "중복닉"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.NICKNAME_ALREADY_EXISTS);

		verify(authMapper, never()).insert(any());
	}

	@Test
	void login_success_returnsTokenPairAndTouchesLogin() {
		stubRedis();
		UserAuthDto user = new UserAuthDto();
		user.setEmail("me@gmail.com");
		user.setImageUrl("https://cdn.example.com/a.png");
		user.setPasswordHash(passwordEncoder.encode("password1234"));
		when(authMapper.findByEmail("me@gmail.com")).thenReturn(user);

		TokenPair tokenPair = authService.login("me@gmail.com", "password1234");

		assertThat(jwtTokenProvider.parseClaims(tokenPair.accessToken()).getSubject()).isEqualTo("me@gmail.com");
		verify(authMapper).touchLogin(eq("me@gmail.com"), eq("https://cdn.example.com/a.png"));
	}

	@Test
	void login_wrongPassword_throwsInvalidCredentials() {
		UserAuthDto user = new UserAuthDto();
		user.setEmail("me@gmail.com");
		user.setPasswordHash(passwordEncoder.encode("password1234"));
		when(authMapper.findByEmail("me@gmail.com")).thenReturn(user);

		assertThatThrownBy(() -> authService.login("me@gmail.com", "wrong-password"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.INVALID_CREDENTIALS);
	}

	@Test
	void login_unknownEmail_throwsInvalidCredentials() {
		when(authMapper.findByEmail("nobody@gmail.com")).thenReturn(null);

		assertThatThrownBy(() -> authService.login("nobody@gmail.com", "password1234"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.INVALID_CREDENTIALS);
	}

	@Test
	void login_oauthOnlyAccount_throwsInvalidCredentials() {
		UserAuthDto oauthUser = new UserAuthDto();
		oauthUser.setEmail("google@gmail.com");
		oauthUser.setPasswordHash(null);
		when(authMapper.findByEmail("google@gmail.com")).thenReturn(oauthUser);

		assertThatThrownBy(() -> authService.login("google@gmail.com", "any-password"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(AuthErrorCode.INVALID_CREDENTIALS);
	}
}
