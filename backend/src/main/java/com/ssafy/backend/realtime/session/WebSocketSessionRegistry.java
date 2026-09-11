package com.ssafy.backend.realtime.session;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * wsSessionId ↔ email 매핑, sessionEpoch, 세션 단위 seq 발급(R-07).
 * 단일 인스턴스용 in-memory. 다중화 시 Redis 로 이전(R-09).
 *
 * 골격 단계: register/unregister 만 실동작, epoch·seq 는 시그니처+TODO.
 * TODO(정책): 같은 email 두 번째 CONNECT 허용/기존 세션 종료 확정 필요.
 */
@Component
public class WebSocketSessionRegistry {

	private final Map<String, String> sessionToUser = new ConcurrentHashMap<>();

	/**
	 * CONNECT 시 명단올리기
	 * @param wsSessionId
	 * @param email
	 */
	public void register(String wsSessionId, String email) {
		sessionToUser.put(wsSessionId, email);
	}

	/**
	 * DISCONNECT 시 명단에서 삭제
	 * @param wsSessionId
	 * @return
	 */
	public Optional<String> unregister(String wsSessionId) {
		return Optional.ofNullable(sessionToUser.remove(wsSessionId));
	}

	/**
	 * 다중탭으로 열었을 때 하나만 지워지면 명단에서 바로 삭제하지 않음
	 * @param email
	 * @param excludedSessionId
	 * @return
	 */
	public boolean hasOtherSession(String email, String excludedSessionId) {
		return sessionToUser.entrySet().stream()
				.anyMatch(e -> e.getValue().equals(email) && !e.getKey().equals(excludedSessionId));
	}

	/** 재접속마다 증가하는 세션 epoch(만료·구세션 정리 경쟁 방지, FR-005). */
	public long nextEpoch(String email) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** 세션 단위 단조 증가 seq(FR-041, R-07). */
	public long nextSeq(String email) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}
}
