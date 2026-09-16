package com.ssafy.backend.realtime.presence.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.error.RealtimeWsErrorCode;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventBus;
import com.ssafy.backend.realtime.geometry.CoordinateMapper;
import com.ssafy.backend.realtime.geometry.CoordinateMapper.Placement;
import com.ssafy.backend.realtime.port.MusicLocationPort;
import com.ssafy.backend.realtime.presence.dto.JoinRequest;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository.PresenceSnapshot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 접속 생성 · join 배치·이사 · 하트비트 · 이탈/만료 정리 (RT-01·RT-05).
 *
 * connect = 정지(곡 없음, 남에게 안 보임). join = 그 레이어·그 곡에 활성 배치(노출) — play 와 "활성 배치"를
 * 공유하되 만남·play_history 는 없다. 레이어 변경은 같은 곡으로 join 재호출 → 옛→새 레이어 이사.
 * 실제 이동(곡 변경·만남)은 /music/play(-272)에서만 발생.
 *
 * 곡 좌표는 서버가 계산한다. 활성 배치와 이탈이 끝나면 위치 변경을 알린다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class PresenceLifecycleService {

	private final PresenceRedisRepository presenceRedisRepository;
	private final MusicLocationPort musicLocationPort;
	private final CoordinateMapper coordinateMapper;
	private final RealtimeEventBus eventBus; // 곡과 위치 변경 알림

	@Value("${realtime.presence.ttl-ms:45000}")
	private long ttlMs;

	/** CONNECT 직후 — presence 생성(정지: 활성 곡 없음). */
	public void connect(String email, long epoch) {
		presenceRedisRepository.connect(email, epoch, ttlMs);
		log.info("[Presence] 접속 생성 완료 epoch={}", epoch);
	}

	/** 하트비트 — 만료 시각 갱신(FR-022). @return false 면 이미 sweep 됨(STALE) → 컨트롤러가 resync 유도. */
	public boolean heartbeat(String email) {
		return presenceRedisRepository.touch(email, ttlMs);
	}

	/**
	 * 사용자를 곡 청취자로 배치한다.
	 * 첫 곡 배치가 끝나면 진입을 알린다.
	 *
	 * @param email 사용자 이메일
	 * @param request 곡과 레이어
	 * @throws CustomException PRESENCE_ERROR — 좌표 없음/미연결/STALE(로그에 RealtimeWsErrorCode 사유)
	 */
	public void join(String email, JoinRequest request) {
		long musicId = request.musicId();
		int layer = request.layer();

		// 1) 서버 권위 좌표 — 클라 좌표 불신, musicId 로 조회 후 현재 레이어에 배치.
		double[] pc = musicLocationPort.findLocation(musicId)
				.orElseThrow(() -> {
					log.warn("join 거부 reason={} musicId={}", RealtimeWsErrorCode.PRESENCE_LOCATION_NULL, musicId);
					return new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
				});
		Placement p = coordinateMapper.place(pc, layer);

		// 2) old 상태(정지면 null) — 이사 시 옛 레이어에서 빼기 위함.
		PresenceSnapshot before = presenceRedisRepository.snapshot(email);
		if (before == null) {
			log.warn("join 거부 reason={} musicId={}", RealtimeWsErrorCode.PRESENCE_NOT_CONNECTED, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 3) 활성 배치(원자). old 곡·레이어·셀 기준으로 정확히 이동.
		boolean ok = presenceRedisRepository.join(email,
				before.musicId(), before.layer(), before.cellX(), before.cellY(),
				musicId, layer, p.xNorm(), p.yNorm(), p.cellX(), p.cellY());
		if (!ok) {
			log.warn("join STALE reason={} musicId={}", RealtimeWsErrorCode.PRESENCE_STALE, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 첫 곡 배치가 끝나면 주변사람 목록에 들어온 것을 알린다.
		if (before.musicId() == null) {
			eventBus.publish(new PositionChanged(
					email, before.epoch(), layer,
					null, musicId,
					null, p.cellKey(),
					p.xNorm(), p.yNorm()));
		}
		log.info("[Presence] join 완료 musicId={} layer={}", musicId, layer);
	}

	/**
	 * 직접 종료한 사용자를 정리하고 퇴장을 알린다.
	 *
	 * @param email 사용자 이메일
	 * @param epoch 종료할 접속 버전
	 */
	public void leave(String email, long epoch) {
		List<String> removed = presenceRedisRepository.applyLeave(email, epoch);
		publishLeave(email, removed);
		log.info("[Presence] 이탈 처리 완료 epoch={}", epoch);
	}

	/**
	 * 접속이 만료된 사용자를 정리하고 퇴장을 알린다.
	 *
	 * @param email 사용자 이메일
	 * @param sweepTimeMs 만료 확인 시각
	 */
	public void leaveExpired(String email, long sweepTimeMs) {
		List<String> removed = presenceRedisRepository.applyLeaveExpired(email, sweepTimeMs);
		publishLeave(email, removed);
	}

	/**
	 * 실제로 지운 사용자의 퇴장을 알린다.
	 *
	 * @param email 사용자 이메일
	 * @param removed 지운 곡, 위치, 접속 버전
	 */
	private void publishLeave(String email, List<String> removed) {
		if (removed.size() < 5) {
			return;
		}

		Long musicId = Long.valueOf(removed.get(0));
		int layer = Integer.parseInt(removed.get(1));
		String cell = removed.get(2) + ":" + removed.get(3);
		long removedEpoch = Long.parseLong(removed.get(4));
		eventBus.publish(new PositionChanged(
				email, removedEpoch, layer,
				musicId, null,
				cell, null,
				null, null));
	}
}
