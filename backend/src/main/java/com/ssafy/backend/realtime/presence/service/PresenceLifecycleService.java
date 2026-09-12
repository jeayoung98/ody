package com.ssafy.backend.realtime.presence.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.presence.dto.JoinRequest;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 접속 생성 · join 배치·복원 · 하트비트 · 이탈/만료 정리 (RT-01·RT-05).
 *
 * 초기 진입해서, 정지(복원) 상태는 본인에게만 노출한다 — join 은 활성 청취(listeners/셀/usercount)를 만들지 않고
 * 사용자의 현재 레이어만 기록한다. 실제 진입(만남·이동)은 /music/play 에서만 발생(step ⑥).
 * 정지 마커는 클라이언트가 그린다(위치 조작 방지는 "남에게 보이는" 상태에만 필요).
 *
 * 델타 방송(fan-out)은 RT-22/11 범위라 여기서 발행하지 않는다(상태만 관리).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PresenceLifecycleService {

	private final PresenceRedisRepository presenceRedisRepository;

	@Value("${realtime.presence.ttl-ms:45000}")
	private long ttlMs;

	/** CONNECT 직후 — presence 생성(비노출: 활성 곡 없음). */
	public void connect(String email, long epoch) {
		presenceRedisRepository.connect(email, epoch, ttlMs);
	}

	/** 하트비트 — 만료 시각 갱신(FR-022). */
	public void heartbeat(String email) {
		presenceRedisRepository.touch(email, ttlMs);
	}

	/**
	 * join = 배치·복원. (가) 활성 청취는 만들지 않고 레이어만 기록한다.
	 * 마지막 곡 마커는 클라이언트가 그린다. play_history 대조(조작 방지)는 B-2·FE2 확정 후 추가(TODO).
	 */
	public void join(String email, JoinRequest request) {
		presenceRedisRepository.setLayer(email, request.layer());
	}

	/** 이탈/만료 정리 — presence·청취자·셀·인원수·만료큐 제거(FR-020·021). */
	public void leave(String email, long epoch) {
		presenceRedisRepository.applyLeave(email, epoch);
		// 제거 정보(LEAVE 델타)는 RT-22 구독자에게 방송 — 이번 범위 밖.
	}
}
