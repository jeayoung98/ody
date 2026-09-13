package com.ssafy.backend.realtime.presence.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.common.RealtimeErrorCode;
import com.ssafy.backend.realtime.common.RealtimeErrorCode.WsCode;
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
 * 곡 좌표는 클라 신뢰 없이 musicId 로 서버가 계산(CoordinateMapper). realtime 프로파일에서만 활성.
 * 델타 방송(fan-out)은 RT-22/11 범위라 여기서 발행하지 않는다(상태만 관리).
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class PresenceLifecycleService {

	private final PresenceRedisRepository presenceRedisRepository;
	private final MusicLocationPort musicLocationPort;
	private final CoordinateMapper coordinateMapper;

	@Value("${realtime.presence.ttl-ms:45000}")
	private long ttlMs;

	/** CONNECT 직후 — presence 생성(정지: 활성 곡 없음). */
	public void connect(String email, long epoch) {
		presenceRedisRepository.connect(email, epoch, ttlMs);
	}

	/** 하트비트 — 만료 시각 갱신(FR-022). @return false 면 이미 sweep 됨(STALE) → 컨트롤러가 resync 유도. */
	public boolean heartbeat(String email) {
		return presenceRedisRepository.touch(email, ttlMs);
	}

	/**
	 * join = 배치·이사. musicId 의 서버 좌표를 현재 레이어에 계산해 활성 배치한다(노출).
	 * 같은 곡으로 다른 레이어에 join 하면 옛→새 레이어로 이사. 만남·play_history 없음.
	 *
	 * @throws CustomException PRESENCE_ERROR — 좌표 없음/미연결/STALE(로그에 WsCode 사유)
	 */
	public void join(String email, JoinRequest request) {
		long musicId = request.musicId();
		int layer = request.layer();

		// 1) 서버 권위 좌표 — 클라 좌표 불신, musicId 로 조회 후 현재 레이어에 배치.
		double[] pc = musicLocationPort.findLocation(musicId)
				.orElseThrow(() -> {
					log.warn("join 거부 reason={} musicId={}", WsCode.PRESENCE_LOCATION_NULL, musicId);
					return new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
				});
		Placement p = coordinateMapper.place(pc, layer);

		// 2) old 상태(정지면 null) — 이사 시 옛 레이어에서 빼기 위함.
		PresenceSnapshot before = presenceRedisRepository.snapshot(email);
		if (before == null) {
			log.warn("join 거부 reason={} musicId={}", WsCode.PRESENCE_NOT_CONNECTED, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 3) 활성 배치(원자). old 곡·레이어·셀 기준으로 정확히 이동.
		boolean ok = presenceRedisRepository.join(email,
				before.musicId(), before.layer(), before.cellX(), before.cellY(),
				musicId, layer, p.xNorm(), p.yNorm(), p.cellX(), p.cellY());
		if (!ok) {
			log.warn("join STALE reason={} musicId={}", WsCode.PRESENCE_STALE, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
	}

	/** 명시적 이탈/DISCONNECT 정리 — 그 세션 epoch 가드로 presence·청취자·셀·인원수·만료큐 제거(FR-020·021). */
	public void leave(String email, long epoch) {
		presenceRedisRepository.applyLeave(email, epoch);
		// 제거 정보(LEAVE 델타)는 RT-22 구독자에게 방송 — 이번 범위 밖.
	}

	/** 만료 정리(Sweep 백스톱) — 만료 감지 시각 기준으로 여전히 만료일 때만 정리(P2-c). 재접속이면 no-op. */
	public void leaveExpired(String email, long sweepTimeMs) {
		presenceRedisRepository.applyLeaveExpired(email, sweepTimeMs);
	}
}
