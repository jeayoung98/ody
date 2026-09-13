package com.ssafy.backend.realtime.presence.service;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.common.RealtimeEventBus;
import com.ssafy.backend.realtime.common.RealtimePublisher;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * ★ 재생 선언 = 위치 이동의 유일한 원본 (RT-02, /music/play). plan §F2.
 * 순서: 좌표 계산(Lua 밖) → applyPlay(원자) → play_history INSERT → EventBus 발행 → 만남(비동기).
 *
 * 골격 단계: 시그니처+TODO. play_history·meeting 매퍼는 ERD 확정(B-2) 후 주입 — 지금은 미주입.
 * REST 컨트롤러(/music/play)는 다음 단계(play/ 패키지).
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class PlayDeclarationService {

	private final PresenceRedisRepository presenceRedisRepository;
	private final RealtimePublisher publisher;
	private final RealtimeEventBus eventBus;

	/** @return 응답용 {playHistoryId, musicId, layer, x, y, cellX, cellY} (골격: 반환 타입 미정 → Object). */
	public Object play(String email, long musicId, String source) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}
}
