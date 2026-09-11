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

//CONNECT 프레임에서 JWT 검증 → STOMP에 Principal(email)
// 브로커 스레드풀 재사용으로 다음 메시지가 이전 사용자 권한을 물려받을 수 있어서 SecurityContextHolder 심지 않음


@Slf4j
@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

	private static final String BEARER_PREFIX = "Bearer ";

	private final JwtTokenProvider jwtTokenProvider;

	@Override
	public Message<?> preSend(Message<?> message, MessageChannel channel) {
		StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

		// CONNECT 아니면 보내줌
		if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
			return message;
		}

		//-------------------------CONNECT 검사
		// 로그인 안해서 헤더 없으면 거부
		String header = accessor.getFirstNativeHeader("Authorization");
		if (header == null || !header.startsWith(BEARER_PREFIX)) {
			throw new IllegalArgumentException("REALTIME_AUTH_MISSING"); // TODO: RealtimeErrorCode 로 교체
		}
		// 토큰 위조, 만료 되어있으면 거부
		Claims claims = jwtTokenProvider.parseClaims(header.substring(BEARER_PREFIX.length()));
		if (!jwtTokenProvider.isAccessToken(claims)) {
			throw new IllegalArgumentException("REALTIME_AUTH_INVALID_TOKEN_TYPE");
		}
		//토큰에서 이메일 꺼내서 세션에 ㅌ넣음
		accessor.setUser(new StompPrincipal(claims.getSubject()));
		log.debug("[WS] CONNECT 인증 완료"); // 식별자·토큰 로그 금지
		return message;
	}

	// STOMP 세션에 붙는 최소 Principal (name = email)
	public record StompPrincipal(String name) implements Principal {
		@Override
		public String getName() {
			return name;
		}
	}
}
