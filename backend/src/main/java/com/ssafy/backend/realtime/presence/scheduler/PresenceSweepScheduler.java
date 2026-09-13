package com.ssafy.backend.realtime.presence.scheduler;

import java.util.Set;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;

import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.presence.service.PresenceLifecycleService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 5s 만료 정리(백스톱) + 60s 셀 인원수 재검증(RT-05·RT-23).
 *
 * 만료 정리는 하트비트 끊긴 사용자를 TTL 경과 후 자동 leave 한다(onClose 백스톱).
 * 재검증은 증분 카운터 drift 를 원천 대조로 복구한다(60s 무조건 실행 — drift 는 조용히 쌓임).
 */
@Slf4j
@Component
@Profile("realtime")
@RequiredArgsConstructor
public class PresenceSweepScheduler {

	/** 유효 레이어 상한(PC16 → 8). RealtimeProperties 와 동일해야 함(데이터 버전 종속). */
	private static final int MAX_LAYER = 8;

	private final PresenceLifecycleService lifecycleService;
	private final PresenceRedisRepository presenceRedisRepository;

	/** 만료 시각 경과 사용자를 정리. 각 email 의 현재 epoch 으로 leave(재접속 경쟁은 epoch 가드가 no-op 처리). */
	@Scheduled(fixedDelayString = "${realtime.presence.sweep-interval-ms:5000}")
	public void sweep() {
		try {
			// 만료 감지 시각을 기준으로 삼는다 — leave.lua 가 이 시각으로 expiry 를 재확인해
			// 감지·삭제 사이 재접속한 세션은 지우지 않는다(P2-c). epoch 재조회 없음.
			long sweepTime = System.currentTimeMillis();
			Set<String> expired = presenceRedisRepository.expired(sweepTime);
			for (String email : expired) {
				try {
					lifecycleService.leaveExpired(email, sweepTime);
				} catch (Exception e) {
					log.warn("sweep: 만료 사용자 정리 실패 — 스킵", e); // email 은 로그에 남기지 않는다
				}
			}
		} catch (Exception e) {
			log.warn("sweep 실패", e);
		}
	}

	/** 셀 인원수 증분 카운터를 원천과 대조·복구. 불일치는 WARN(지표는 후속). */
	@Scheduled(fixedDelayString = "${realtime.presence.recount-interval-ms:60000}")
	public void recount() {
		for (int layer = 1; layer <= MAX_LAYER; layer++) {
			try {
				long mismatches = presenceRedisRepository.recount(layer);
				if (mismatches > 0) {
					log.warn("usercount recount: layer={} 불일치 {}개 복구", layer, mismatches);
				}
			} catch (Exception e) {
				log.warn("recount 실패 layer={}", layer, e);
			}
		}
	}
}
