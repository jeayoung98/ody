package com.ssafy.backend.realtime.service.presence;

import java.util.List;
import java.util.Objects;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.dto.presence.JoinRequest;
import com.ssafy.backend.realtime.dto.presence.PresenceJoined;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 실시간 접속과 지도 위치를 관리한다.
 * connect는 접속만 만들고, join은 곡 위치에 사용자를 놓는다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class PresenceService {

	private final PresenceRedisRepository presenceRedisRepository;
	private final MusicLocationService musicLocationService;
	private final MusicPositionCalculator musicPositionCalculator;
	private final RealtimeEventService realtimeEventService; // 위치 변경 전달

	@Value("${realtime.presence.ttl-ms:45000}")
	private long ttlMs;

	/**
	 * 소켓이 연결되면 이전 접속 상태를 지우고 새 접속 정보를 만든다.
	 *
	 * @param email 사용자 이메일
	 * @param epoch 새 접속 번호
	 */
	public void connect(String email, long epoch) {
		PresenceSnapshot previous = presenceRedisRepository.snapshot(email);
		if (previous != null && previous.epoch() != null) {
			List<String> removed = presenceRedisRepository.applyLeave(email, previous.epoch());
			sendLeave(email, removed);
		}
		presenceRedisRepository.connect(email, epoch, ttlMs);
		log.info("[Presence] 접속 생성 완료 epoch={}", epoch);
	}

	/**
	 * 접속 만료 시각을 늦춘다.
	 * @return 접속 정보가 남아 있으면 true
	 */
	public boolean heartbeat(String email) {
		return presenceRedisRepository.touch(email, ttlMs);
	}

	/**
	 * 사용자를 곡 위치에 놓는다.
	 * 처음 들어오거나 위치가 바뀌면 변경을 알린다.
	 *
	 * @param email 사용자 이메일
	 * @param expectedEpoch 요청을 보낸 소켓의 접속 번호
	 * @param request 요청 순번, 곡, 레이어
	 * @return 실제로 적용한 곡과 레이어
	 */
	public PresenceJoined join(String email, long expectedEpoch, JoinRequest request) {
		request.validate();
		int layer = request.layer();

		// 1. 현재 접속과 곡을 확인한다.
		PresenceSnapshot before = presenceRedisRepository.snapshot(email);
		if (before == null) {
			throw joinError(WebSocketErrorCode.PRESENCE_NOT_CONNECTED, "먼저 소켓에 연결해야 한다");
		}
		if (!Objects.equals(before.epoch(), expectedEpoch)) {
			throw joinError(WebSocketErrorCode.PRESENCE_STALE, "이전 소켓에서 보낸 입장 요청이다");
		}

		// 2. 첫 입장은 요청 곡, 레이어 이동은 서버의 현재 곡을 쓴다.
		long musicId = before.musicId() == null ? request.musicId() : before.musicId();
		try {
			musicPositionCalculator.findAxes(layer);
		} catch (IllegalArgumentException e) {
			throw joinError(WebSocketErrorCode.PRESENCE_LAYER_INVALID, e.getMessage());
		}
		double[] pc = musicLocationService.findLocation(musicId)
				.orElseThrow(() -> joinError(
						WebSocketErrorCode.PRESENCE_LOCATION_NULL, "곡 위치를 찾을 수 없다"));
		Placement p;
		try {
			p = musicPositionCalculator.calculate(pc, layer);
		} catch (IllegalArgumentException e) {
			throw joinError(WebSocketErrorCode.PRESENCE_LOCATION_NULL, "곡 위치를 계산할 수 없다");
		}

		// 3. 현재 소켓일 때만 이전 위치에서 새 위치로 옮긴다.
		boolean ok = presenceRedisRepository.join(email, expectedEpoch,
				before.musicId(), before.layer(), before.cellX(), before.cellY(),
				musicId, layer, p.xNorm(), p.yNorm(), p.cellX(), p.cellY());
		if (!ok) {
			throw joinError(WebSocketErrorCode.PRESENCE_STALE, "입장 처리 중 접속이나 현재 곡이 바뀌었다");
		}

		// 처음 자리를 잡거나 곡·레이어·셀이 바뀌면 새 위치를 알린다.
		String oldCell = before.musicId() == null ? null : before.cellX() + ":" + before.cellY();
		boolean positionChanged = before.musicId() == null
				|| !Objects.equals(before.musicId(), musicId)
				|| !Objects.equals(before.layer(), layer)
				|| !Objects.equals(oldCell, p.cellKey());
		if (positionChanged) {
			realtimeEventService.send(new PositionChanged(
					email, before.epoch(), before.musicId() == null ? null : before.layer(), layer,
					before.musicId(), musicId,
					oldCell, p.cellKey(),
					p.xNorm(), p.yNorm()));
		}
		log.info("[Presence] join 완료 musicId={} layer={}", musicId, layer);
		return new PresenceJoined(request.requestSeq(), layer, musicId);
	}

	/** 입장 실패 원인만 남기고 사용자 정보는 로그에 쓰지 않는다. */
	private WebSocketRequestException joinError(WebSocketErrorCode code, String message) {
		log.warn("join 거부 reason={}", code);
		return new WebSocketRequestException(code, message);
	}

	/**
	 * 직접 나간 사용자의 위치를 지우고 퇴장을 알린다.
	 *
	 * @param email 사용자 이메일
	 * @param epoch 종료할 접속 버전
	 */
	public void leave(String email, long epoch) {
		List<String> removed = presenceRedisRepository.applyLeave(email, epoch);
		sendLeave(email, removed);
		log.info("[Presence] 이탈 처리 완료 epoch={}", epoch);
	}

	/**
	 * 접속이 만료된 사용자의 위치를 지우고 퇴장을 알린다.
	 *
	 * @param email 사용자 이메일
	 * @param sweepTimeMs 만료 확인 시각
	 */
	public void leaveExpired(String email, long sweepTimeMs) {
		List<String> removed = presenceRedisRepository.applyLeaveExpired(email, sweepTimeMs);
		sendLeave(email, removed);
	}

	/**
	 * 위치가 실제로 지워졌을 때만 퇴장을 알린다.
	 *
	 * @param email 사용자 이메일
	 * @param removed 지운 곡, 위치, 접속 버전
	 */
	private void sendLeave(String email, List<String> removed) {
		if (removed.size() < 5) {
			return;
		}

		Long musicId = Long.valueOf(removed.get(0));
		int layer = Integer.parseInt(removed.get(1));
		String cell = removed.get(2) + ":" + removed.get(3);
		long removedEpoch = Long.parseLong(removed.get(4));
		realtimeEventService.send(new PositionChanged(
				email, removedEpoch, layer, null,
				musicId, null,
				cell, null,
				null, null));
	}
}
