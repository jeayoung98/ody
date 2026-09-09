package com.ssafy.backend.security;

import java.io.IOException;
import java.util.List;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String BLACKLIST_KEY_PREFIX = "blacklist:";

	private final JwtTokenProvider jwtTokenProvider;
	private final StringRedisTemplate redisTemplate;

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {

		String token = jwtTokenProvider.resolveToken(request);

		if (token != null) {
			try {
				Claims claims = jwtTokenProvider.parseClaims(token);

				if (jwtTokenProvider.isAccessToken(claims) && !isBlacklisted(claims.getId())) {
					String email = claims.getSubject();
					Authentication authentication = new UsernamePasswordAuthenticationToken(
							email, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
					SecurityContextHolder.getContext().setAuthentication(authentication);
					log.debug("[JWT] 인증 성공 email={}", email);
				} else {
					log.warn("[JWT] 거부된 토큰 (블랙리스트에 등록되었거나 access token이 아님)");
				}
			} catch (JwtException | IllegalArgumentException e) {
				log.warn("[JWT] 토큰 검증 실패: {}", e.getMessage());
			}
		}

		filterChain.doFilter(request, response);
	}

	private boolean isBlacklisted(String jti) {
		return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_KEY_PREFIX + jti));
	}
}
