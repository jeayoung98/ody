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
import com.ssafy.backend.realtime.repository.mapper.PlayHistoryMapper;
import com.ssafy.backend.realtime.service.ride.RideService;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.dto.presence.JoinRequest;
import com.ssafy.backend.realtime.dto.presence.PresenceJoined;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.LeaveResult;
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
	private final PlayHistoryMapper playHistoryMapper; // 첫 입장 때 마지막 재생곡 확인
	private final RideService rideService; // 나가는 사람의 따라가기 정리

	@Value("${realtime.presence.ttl-ms:45000}")
	private long ttlMs;

	/**
	 * 소켓이 연결되면 새 접속 정보를 만든다.
	 *
	 * 같은 사용자의 다른 탭이 남아 있지 않을 때만 이전 위치를 지운다.
	 * 다른 탭이 열려 있는데 지우면 지도에서 잠깐 사라졌다가 다시 나타나고,
	 * 새 탭의 입장이 "첫 입장"이 되어 듣던 곡을 잃는다.
	 * 지우지 않으면 새 탭이 서버에 남은 곡을 그대로 물려받는다.
	 * 어느 쪽이든 조종권은 마지막에 연결한 탭에 있다(접속 번호 비교).
	 *
	 * @param email 사용자 이메일
	 * @param epoch 새 접속 번호
	 */
	public void connect(String email, long epoch) {
		// 새 접속은 언제나 새 출발이다. 탭을 여러 개 켜도 마지막 것만 산다 —
		// 접속 번호가 올라가 앞의 탭이 보내는 요청은 그 뒤로 전부 거부된다.
		PresenceSnapshot previous = presenceRedisRepository.snapshot(email);
		if (previous != null && previous.epoch() != null) {
			LeaveResult result = presenceRedisRepository.applyLeave(email, previous.epoch());
			if (result.applied()) {
				sendLeave(email, result.removed());
			}
		}
		// 따라가기도 끊는다. 다시 연결하면 단독으로 돌아온다.
		rideService.onUserGone(email);
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
	 * 곡은 어느 경우에도 클라이언트 값을 믿지 않는다.
	 * 첫 입장은 이 사용자의 마지막 재생 기록으로 정하고, 기록이 없으면 거부한다(재생 전엔 지도에 안 보임).
	 * 이후 입장(레이어 이동)은 서버에 남아 있는 현재 곡을 유지한다.
	 * 요청의 musicId 는 참고값이며, 다르면 서버 값을 쓰고 PresenceJoined 로 알려준다.
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

		// 2. 놓을 곡을 정한다. 첫 입장은 마지막 재생 기록, 레이어 이동은 서버의 현재 곡.
		long musicId = before.musicId() != null ? before.musicId() : resolveFirstJoinMusic(email, request);
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

	/**
	 * 첫 입장에서 놓을 곡을 마지막 재생 기록으로 정한다.
	 * 클라이언트가 보낸 곡을 그대로 믿으면 재생하지 않은 곡 자리에 설 수 있어(좌표 조작),
	 * 서버가 가진 기록만 인정한다. 기록이 없으면 아직 지도에 나올 수 없다 — 첫 재생이 첫 배치다.
	 *
	 * @param email 사용자 이메일
	 * @param request 클라이언트가 보낸 입장 요청(musicId 는 참고값)
	 * @return 실제로 놓을 곡 ID
	 * @throws WebSocketRequestException 재생 기록이 없는 경우
	 */
	private long resolveFirstJoinMusic(String email, JoinRequest request) {
		Long latest = playHistoryMapper.findLatestMusicId(email);
		if (latest == null) {
			throw joinError(WebSocketErrorCode.PRESENCE_NO_ANCHOR,
					"재생 기록이 없어 입장할 수 없다. 먼저 곡을 재생해야 한다");
		}
		if (!latest.equals(request.musicId())) {
			// 요청과 다르면 서버 기록을 쓴다. 어떤 곡으로 바뀌었는지는 응답(PresenceJoined)이 알린다.
			log.debug("join 곡 보정 requested={} latest={}", request.musicId(), latest);
		}
		return latest;
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
		LeaveResult result = presenceRedisRepository.applyLeave(email, epoch);
		// 옛 접속의 종료 요청이면 아무것도 안 바뀐다. 그 사람은 아직 접속해 있으니 따라가기도 그대로 둔다.
		if (!result.applied()) {
			log.info("[Presence] 이탈 건너뜀 — 옛 접속의 요청 epoch={}", epoch);
			return;
		}
		sendLeave(email, result.removed());
		// 지도에서 지운 뒤에 정리한다. 인솔자였으면 따라가던 사람들이 빈 자리로 돌아온다.
		rideService.onUserGone(email);
		log.info("[Presence] 이탈 처리 완료 epoch={}", epoch);
	}

	/**
	 * 접속이 만료된 사용자의 위치를 지우고 퇴장을 알린다.
	 *
	 * @param email 사용자 이메일
	 * @param sweepTimeMs 만료 확인 시각
	 */
	public void leaveExpired(String email, long sweepTimeMs) {
		LeaveResult result = presenceRedisRepository.applyLeaveExpired(email, sweepTimeMs);
		// 그 사이에 heartbeat 가 도착했으면 아직 살아 있다. 건드리지 않는다.
		if (!result.applied()) {
			return;
		}
		sendLeave(email, result.removed());
		// 연결 종료와 같은 길이다. 둘로 나누면 한쪽만 고쳐진다.
		rideService.onUserGone(email);
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
