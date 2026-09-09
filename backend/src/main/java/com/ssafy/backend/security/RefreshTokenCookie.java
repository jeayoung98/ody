package com.ssafy.backend.security;

import java.time.Duration;

import org.springframework.http.ResponseCookie;

public final class RefreshTokenCookie {

	private static final String COOKIE_NAME = "refreshToken";
	private static final String COOKIE_PATH = "/api/auth";

	private RefreshTokenCookie() {
	}

	public static String issue(String refreshToken, long maxAgeMillis) {
		return build(refreshToken, Duration.ofMillis(maxAgeMillis));
	}

	public static String clear() {
		return build("", Duration.ZERO);
	}

	private static String build(String value, Duration maxAge) {
		return ResponseCookie.from(COOKIE_NAME, value)
				.httpOnly(true)
				.secure(true)
				.sameSite("Lax")
				.path(COOKIE_PATH)
				.maxAge(maxAge)
				.build()
				.toString();
	}
}
