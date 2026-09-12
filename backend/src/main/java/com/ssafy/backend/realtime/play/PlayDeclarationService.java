package com.ssafy.backend.realtime.play;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.common.RealtimeEventBus;
import com.ssafy.backend.realtime.common.RealtimePublisher;
import com.ssafy.backend.realtime.play.dto.PlayResponse;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 재생 선언 = 위치 이동의 유일한 원본 (RT-02, /music/play). plan §F2.
 * 순서: presence 스냅샷 → 곡좌표 조회 → CoordinateMapper 배치 → applyPlay(원자) →
 *       play_history INSERT → (EventBus 발행) → 만남(비동기).
 *
 * 골격 단계(①): 컨트롤러 배선용 시그니처만. 본문은 ②(좌표·재생)/③(play_history)/④(만남)에서 채운다.
 * realtime 프로파일에서만 활성(다음 단계에서 CoordinateMapper·MusicLocationPort 주입 예정).
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class PlayDeclarationService {

	private final PresenceRedisRepository presenceRedisRepository;
	private final RealtimePublisher publisher;
	private final RealtimeEventBus eventBus;

	/**
	 * 재생 선언. musicId 로 서버가 좌표를 계산해 위치를 이동시킨다.
	 *
	 * @return {playHistoryId, musicId, layer, x, y, cellX, cellY}
	 */
	public PlayResponse play(String email, long musicId, String source) {
		throw new UnsupportedOperationException("TODO(②③④)");
	}

	/** 재생 종료 — played_ms 갱신(멱등, 소유자 검증). 위치 불변. */
	public void playEnd(String email, long playHistoryId, long playedMs) {
		throw new UnsupportedOperationException("TODO(③)");
	}
}
