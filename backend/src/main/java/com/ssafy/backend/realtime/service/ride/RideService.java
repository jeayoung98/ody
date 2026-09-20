package com.ssafy.backend.realtime.service.ride;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.dto.play.PlaySource;
import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RidePlayback;
import com.ssafy.backend.realtime.dto.ride.RideResponse;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountStatus;
import com.ssafy.backend.realtime.service.play.MusicPlayService;
import com.ssafy.backend.realtime.service.play.MusicPlayService.Placed;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 따라가기를 시작한다.
 * 자격을 확인해 등록하고, 인솔자가 서 있는 곡으로 옮긴 뒤, 어디서부터 틀면 되는지 알려준다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class RideService {

	/** 한 사람을 따라갈 수 있는 인원. 넘으면 인솔자에게 가는 알림과 개인 큐 발송이 그만큼 늘어난다. */
	private static final int MAX_RIDERS = 20;

	private final RideRedisRepository rideRedisRepository;
	private final PresenceRedisRepository presenceRedisRepository;
	private final MusicPlayService musicPlayService;
	private final RidePlaybackService ridePlaybackService;

	/**
	 * 따라가기를 시작한다.
	 *
	 * @return 옮겨진 자리와 틀어야 할 곡·위치
	 * @throws CustomException 자격 확인에 걸리면 사유별 코드로 거부한다
	 */
	@Transactional
	public RideResponse mount(String riderEmail, String captainEmail) {
		// 1. 자기 자신은 Redis 를 볼 것도 없이 막는다.
		if (riderEmail.equals(captainEmail)) {
			throw new CustomException(RealtimeErrorCode.RIDE_SELF);
		}

		// 2. 내 접속 정보를 읽는다. 옮길 때 이전 자리로도 쓴다.
		PresenceSnapshot before = presenceRedisRepository.snapshot(riderEmail);
		if (before == null || before.epoch() == null) {
			log.warn("따라가기 거부 reason={}", WebSocketErrorCode.PRESENCE_NOT_CONNECTED);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 3. 자격 확인과 등록을 한 번에 한다.
		MountResult mounted = rideRedisRepository.mount(
				riderEmail, captainEmail, before.epoch(), MAX_RIDERS);
		if (mounted.status() != MountStatus.OK) {
			log.info("따라가기 거부 reason={}", mounted.status());
			throw new CustomException(toErrorCode(mounted.status()));
		}

		// 4. 인솔자가 서 있는 곡으로 옮기고 재생 기록을 남긴다.
		//    발견자 기록과 만남 기록은 하지 않는다 — placeOnMusic 이 그 둘을 빼 둔 이유다.
		Placed placed = musicPlayService.placeOnMusic(
				riderEmail, before, mounted.musicId(), mounted.layer(), PlaySource.FOLLOW.name());

		// 5. 어디서부터 틀을지 읽는다. 여기서 받은 번호가 이 응답의 기준이 된다.
		RidePlayback playback = resolvePlayback(captainEmail, mounted.musicId());

		log.info("[Ride] 따라가기 시작 musicId={} layer={} snapshotSeq={}",
				mounted.musicId(), mounted.layer(), playback.snapshotSeq());
		return new RideResponse(captainEmail, placed.playHistoryId(),
				mounted.musicId(), mounted.layer(),
				placed.x(), placed.y(), placed.cellX(), placed.cellY(),
				playback.state(), playback.positionMs(), playback.snapshotSeq());
	}

	/**
	 * 어디서부터 틀지 정한다.
	 *
	 * 옮겨 놓은 곡과 읽어 온 곡이 다르면 읽어 온 값을 버리고 처음부터 튼다.
	 * 자격 확인과 재생 정보 읽기 사이에 인솔자가 곡을 바꾼 경우인데, 이미 옮겨 놓은 자리가 있으니
	 * 그 곡을 기준으로 삼아야 자리와 소리가 어긋나지 않는다. 바뀐 곡은 곧 이벤트로 따라잡는다.
	 */
	private RidePlayback resolvePlayback(String captainEmail, long placedMusicId) {
		RidePlayback playback = ridePlaybackService.read(captainEmail);
		if (playback == null || playback.musicId() != placedMusicId) {
			return new RidePlayback(placedMusicId, PlaybackState.PLAYING, 0L, 0L);
		}
		return playback;
	}

	/** 거부 사유를 응답 코드로 바꾼다. */
	private static RealtimeErrorCode toErrorCode(MountStatus status) {
		return switch (status) {
			case ALREADY_RIDING -> RealtimeErrorCode.RIDE_ALREADY_RIDING;
			case CHAIN -> RealtimeErrorCode.RIDE_CHAIN_FORBIDDEN;
			case CAPTAIN_INACTIVE -> RealtimeErrorCode.RIDE_CAPTAIN_INACTIVE;
			case FULL -> RealtimeErrorCode.RIDE_FULL;
			// STALE 은 재연결 전 탭이 보낸 요청이다. 다시 연결하면 풀린다.
			default -> RealtimeErrorCode.PRESENCE_ERROR;
		};
	}
}
