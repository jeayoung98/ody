package com.ssafy.backend.realtime.config;

import java.security.Principal;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import com.ssafy.backend.security.JwtTokenProvider;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** WebSocket 연결 요청의 JWT를 검사하고 로그인 사용자를 저장한다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

	private static final String BEARER_PREFIX = "Bearer ";

	private final JwtTokenProvider jwtTokenProvider;

	@Override
	public Message<?> preSend(Message<?> message, MessageChannel channel) {
		StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

		// 연결 요청만 인증한다.
		if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
			return message;
		}

		// 인증 헤더가 없으면 연결을 거부한다.
		String header = accessor.getFirstNativeHeader("Authorization");
		if (header == null || !header.startsWith(BEARER_PREFIX)) {
			throw new IllegalArgumentException("REALTIME_AUTH_MISSING"); // TODO: RealtimeErrorCode 로 교체
		}
		// 사용할 수 없는 토큰이면 연결을 거부한다.
		Claims claims = jwtTokenProvider.parseClaims(header.substring(BEARER_PREFIX.length()));
		if (!jwtTokenProvider.isAccessToken(claims)) {
			throw new IllegalArgumentException("REALTIME_AUTH_INVALID_TOKEN_TYPE");
		}
		// 토큰의 이메일을 현재 연결 사용자로 저장한다.
		accessor.setUser(new WebSocketPrincipal(claims.getSubject()));
		log.debug("[WS] CONNECT 인증 완료"); // 식별자·토큰 로그 금지
		return message;
	}

	/** 현재 연결의 로그인 사용자. */
	public record WebSocketPrincipal(String name) implements Principal {
		@Override
		public String getName() {
			return name;
		}
	}
}
