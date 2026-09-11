package com.ssafy.backend.realtime.presence.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.common.RealtimePublisher;
import com.ssafy.backend.realtime.presence.dto.JoinRequest;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.session.WebSocketSessionRegistry;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 접속 생성 · join 배치·복원(Q1) · 하트비트 · 이탈/만료 정리 (RT-01·RT-05).
 * 골격 단계: 시그니처+TODO. 설정값은 @Value 기본값으로 읽어 프로파일 없이 기동(내부작업 때 RealtimeProperties 로 전환).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PresenceLifecycleService {

	private final PresenceRedisRepository presenceRedisRepository;
	private final RealtimePublisher publisher;
	private final WebSocketSessionRegistry sessionRegistry;

	@Value("${realtime.presence.ttl-ms:45000}")
	private long ttlMs;

	/** CONNECT 직후 — presence 생성(playingMusicId=null, 비노출). */
	public void connect(String email, long epoch) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** 하트비트 — 만료 시각 갱신(FR-022). */
	public void heartbeat(String email) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** join = 배치·복원. play_history 최신 1건 대조 후 그 곡 좌표로 노출. INSERT·만남 없음(FR-006, Q1). */
	public void join(String email, JoinRequest request) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** 이탈/만료 정리 — 청취자·셀·인원수·구독 인덱스·presence 전부 제거(FR-020·021). */
	public void leave(String email, long epoch) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}
}
