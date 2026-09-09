package com.ssafy.backend.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import jakarta.servlet.http.HttpServletRequest;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class JwtTokenProvider {

	private static final String BEARER_PREFIX = "Bearer ";
	private static final String CLAIM_TOKEN_TYPE = "tokenType";
	private static final String TOKEN_TYPE_ACCESS = "access";
	private static final String TOKEN_TYPE_REFRESH = "refresh";

	private final SecretKey key;
	private final long accessTokenExpirationMs;
	private final long refreshTokenExpirationMs;

	public JwtTokenProvider(
			@Value("${app.jwt.secret}") String secret,
			@Value("${app.jwt.access-token-expiration-ms}") long accessTokenExpirationMs,
			@Value("${app.jwt.refresh-token-expiration-ms}") long refreshTokenExpirationMs) {
		this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
		this.accessTokenExpirationMs = accessTokenExpirationMs;
		this.refreshTokenExpirationMs = refreshTokenExpirationMs;
	}

	public String createAccessToken(String email) {
		return createToken(email, TOKEN_TYPE_ACCESS, accessTokenExpirationMs);
	}

	public String createRefreshToken(String email) {
		return createToken(email, TOKEN_TYPE_REFRESH, refreshTokenExpirationMs);
	}

	private String createToken(String email, String tokenType, long expirationMs) {
		Date now = new Date();
		Date expiry = new Date(now.getTime() + expirationMs);

		String token = Jwts.builder()
				.subject(email)
				.id(UUID.randomUUID().toString())
				.claim(CLAIM_TOKEN_TYPE, tokenType)
				.issuedAt(now)
				.expiration(expiry)
				.signWith(key)
				.compact();

		log.debug("[JWT] {} 토큰 발급 email={} expiry={}", tokenType, email, expiry);
		return token;
	}

	public Claims parseClaims(String token) {
		return Jwts.parser()
				.verifyWith(key)
				.build()
				.parseSignedClaims(token)
				.getPayload();
	}

	public boolean isAccessToken(Claims claims) {
		return TOKEN_TYPE_ACCESS.equals(claims.get(CLAIM_TOKEN_TYPE, String.class));
	}

	public boolean isRefreshToken(Claims claims) {
		return TOKEN_TYPE_REFRESH.equals(claims.get(CLAIM_TOKEN_TYPE, String.class));
	}

	public long getRemainingMillis(Claims claims) {
		return claims.getExpiration().getTime() - System.currentTimeMillis();
	}

	public long getRefreshTokenExpirationMs() {
		return refreshTokenExpirationMs;
	}

	public String resolveToken(HttpServletRequest request) {
		String header = request.getHeader(HttpHeaders.AUTHORIZATION);
		if (StringUtils.hasText(header) && header.startsWith(BEARER_PREFIX)) {
			return header.substring(BEARER_PREFIX.length());
		}
		return null;
	}
}
