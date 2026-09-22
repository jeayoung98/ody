package com.ssafy.backend.realtime.scheduler;

import java.util.Objects;
import java.util.Set;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;

import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.Ride;
import com.ssafy.backend.realtime.service.presence.PresenceService;
import com.ssafy.backend.realtime.service.ride.RideService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 5s 만료 정리(백스톱) + 60s 셀 인원수 재검증(RT-05·RT-23).
 * 만료 정리는 하트비트 끊긴 사용자를 TTL 경과 후 자동 leave 한다(onClose 백스톱).
 * 재검증은 증분 카운터 drift 를 원천 대조로 복구한다(60s 무조건 실행 — drift 는 조용히 쌓임).
 */
@Slf4j
@Component
@Profile("realtime")
@RequiredArgsConstructor
public class PresenceCleanupScheduler {

	private final MusicPositionCalculator musicPositionCalculator;
	private final PresenceService presenceService;
	private final PresenceRedisRepository presenceRedisRepository;
	private final RideRedisRepository rideRedisRepository;
	private final RideService rideService;

	/**
	 * 접속은 없거나 바뀌었는데 ride:captain 이 남은 사람을 정리한다(유령 따라가기 백스톱).
	 * 정상 경로(하차·해체·접속 끊김·재접속)는 모두 등록을 지우므로, 남았다면 그 정리가 예외로 건너뛰어진 것이다.
	 * 남아 있으면 그 사람의 재생·입장이 RIDE_NOT_CAPTAIN 으로 계속 막힌다.
	 */
	@Scheduled(fixedDelayString = "${realtime.presence.ride-orphan-sweep-interval-ms:30000}")
	public void sweepOrphanRides() {
		try {
			for (String email : rideRedisRepository.ridingEmails()) {
				try {
					Ride ride = rideRedisRepository.findRide(email);
					if (ride == null) {
						continue; // 훑는 사이에 내렸다
					}
					// 접속 번호가 같으면 지금 연결에서 만든 살아 있는 탑승이다. 건드리지 않는다.
					PresenceSnapshot presence = presenceRedisRepository.snapshot(email);
					if (presence != null && Objects.equals(presence.epoch(), ride.epoch())) {
						continue;
					}
					// 접속 끊김과 같은 길로 정리한다. 둘로 나누면 한쪽만 고쳐진다.
					rideService.onUserGone(email);
					log.warn("orphan ride sweep: 남은 따라가기 정리 presenceAlive={}", presence != null);
				} catch (Exception e) {
					log.warn("orphan ride sweep: 정리 실패 — 스킵", e); // email 은 로그에 남기지 않는다
				}
			}
		} catch (Exception e) {
			log.warn("orphan ride sweep 실패", e);
		}
	}

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
					presenceService.leaveExpired(email, sweepTime);
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
		int maxLayer = musicPositionCalculator.maxLayer(); // 축 설정(axis-range) 단일 출처
		for (int layer = 0; layer < maxLayer; layer++) { // 레이어 번호는 0-based
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
