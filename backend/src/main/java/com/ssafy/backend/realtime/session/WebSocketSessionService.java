package com.ssafy.backend.realtime.session;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Component;

/**
 * WebSocket 연결 정보를 메모리에 보관한다. 단일 서버용이다.
 * 세션 ID = 연결을 찾는 이름
 * epoch = 그 연결이 최신인지 확인하는 버전. 재접속할 때 올려서 옛 연결이 새 상태를 지우지 못하게 한다.
 * seq = 메시지 순번. 보낼 때 올려서 클라이언트가 메시지 순서를 확인하게 한다.
 * 흐름: CONNECT → register, 발송 → nextMessageSeq, LEAVE → findEpoch, DISCONNECT → unregister.
 * TODO(정책): 같은 email 두 번째 CONNECT 시 기존 활성 세션을 강제로 끊을지는 별도로 확정한다.
 */
@Component
public class WebSocketSessionService {

	public record SessionInfo(String email, long epoch) {
	}

	private final Map<String, SessionInfo> sessions = new ConcurrentHashMap<>(); //세션 ID → 사용자·연결 버전
	private final Map<String, AtomicLong> epochByEmail = new ConcurrentHashMap<>(); // 사용자 → 마지막 연결 버전
	private final Map<String, AtomicLong> seqByEmail = new ConcurrentHashMap<>(); //사용자 → 마지막 메시지 순번

	/** CONNECT: 세션을 등록하고 새 연결 버전을 반환한다. */
	public long register(String wsSessionId, String email) {
		long epoch = epochByEmail.computeIfAbsent(email, k -> new AtomicLong()).incrementAndGet();
		seqByEmail.computeIfAbsent(email, k -> new AtomicLong());
		sessions.put(wsSessionId, new SessionInfo(email, epoch));
		return epoch;
	}

	/** DISCONNECT: 세션을 제거한다. 마지막 연결이면 메시지 순번도 지운다. */
	public Optional<SessionInfo> unregister(String wsSessionId) {
		SessionInfo removed = sessions.remove(wsSessionId);
		if (removed != null && !hasOtherSession(removed.email(), wsSessionId)) {
			seqByEmail.remove(removed.email());
		}
		return Optional.ofNullable(removed);
	}

	/** 같은 사용자의 다른 세션이 남아 있는지 확인한다. */
	public boolean hasOtherSession(String email, String excludedSessionId) {
		return sessions.entrySet().stream()
				.anyMatch(e -> e.getValue().email().equals(email) && !e.getKey().equals(excludedSessionId));
	}

	/** LEAVE: 세션 ID로 연결 버전을 찾는다. */
	public Optional<Long> findEpoch(String wsSessionId) {
		SessionInfo info = sessions.get(wsSessionId);
		return info == null ? Optional.empty() : Optional.of(info.epoch());
	}

	/** 발송: 다음 메시지 순번을 반환한다. 연결이 없으면 0이다. */
	public long nextMessageSeq(String email) {
		AtomicLong seq = seqByEmail.get(email);
		return seq == null ? 0L : seq.incrementAndGet();
	}

	/** 현재 메시지 순번을 반환한다. 연결이 없으면 0이다. */
	public long currentMessageSeq(String email) {
		AtomicLong seq = seqByEmail.get(email);
		return seq == null ? 0L : seq.get();
	}
}
