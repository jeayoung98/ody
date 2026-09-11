package com.ssafy.backend.realtime.presence.scheduler;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.presence.service.PresenceLifecycleService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 5s 만료 정리(백스톱) + 60s 셀 인원수 재검증(RT-05·RT-23). 골격 단계: 스케줄 배선만.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PresenceSweepScheduler {

	private final PresenceLifecycleService lifecycleService;
	private final PresenceRedisRepository presenceRedisRepository;

	@Scheduled(fixedDelayString = "${realtime.presence.sweep-interval-ms:5000}")
	public void sweep() {
		// TODO(내부작업): presenceRedisRepository.expired(now) → 각 email leave
	}

	@Scheduled(fixedDelayString = "${realtime.presence.recount-interval-ms:60000}")
	public void recount() {
		// TODO(내부작업): 레이어 순환 recount → 불일치 WARN + 지표
	}
}
