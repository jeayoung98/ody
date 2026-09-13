package com.ssafy.backend.realtime.session;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Component;

/**
 * wsSessionId ↔ (email, epoch) 매핑. 단일 인스턴스용 in-memory(다중화 시 Redis 이전 — R-09).
 * epoch = 재접속마다 +1 하는 세션 세대. 오래된 세션의 정리(leave/expiry)가 새 세션 presence 를 지우지 못하게 하는 가드용, 버전관리 (FR-005).
 * seq(델타 순번, R-07)는 RT-22 팬아웃에서 사용 — 이번 범위 밖.
 *
 * TODO(정책): 같은 email 두 번째 CONNECT 시 기존 활성 세션 정리 정책(멀티세션) 확정.
 */
@Component
public class WebSocketSessionRegistry {

	/** 세션 정보 — email 과 그 세션의 epoch. */
	public record SessionInfo(String email, long epoch) {
	}

	private final Map<String, SessionInfo> sessions = new ConcurrentHashMap<>();
	private final Map<String, AtomicLong> epochByEmail = new ConcurrentHashMap<>();

	/** CONNECT 시 등록 — 새 epoch 발급·저장하고 반환. */
	public long register(String wsSessionId, String email) {
		long epoch = epochByEmail.computeIfAbsent(email, k -> new AtomicLong()).incrementAndGet();
		sessions.put(wsSessionId, new SessionInfo(email, epoch));
		return epoch;
	}

	/** DISCONNECT 시 제거 — 해당 세션 정보 반환. */
	public Optional<SessionInfo> unregister(String wsSessionId) {
		return Optional.ofNullable(sessions.remove(wsSessionId));
	}

	/** 멀티탭: 같은 email 의 다른 세션이 남아 있으면 true(하나 끊겨도 정리 보류). */
	public boolean hasOtherSession(String email, String excludedSessionId) {
		return sessions.entrySet().stream()
				.anyMatch(e -> e.getValue().email().equals(email) && !e.getKey().equals(excludedSessionId));
	}

	/** 세션 id 로 그 세션의 epoch 조회(명시적 /presence/leave 용). */
	public Optional<Long> epochOf(String wsSessionId) {
		SessionInfo info = sessions.get(wsSessionId);
		return info == null ? Optional.empty() : Optional.of(info.epoch());
	}

	/** 세션 단위 단조 증가 seq(델타 순번, R-07) — RT-22 팬아웃에서 구현. */
	public long nextSeq(String email) {
		throw new UnsupportedOperationException("TODO(RT-22 팬아웃)");
	}
}
