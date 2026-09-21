package com.ssafy.backend.realtime.service.ride;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.realtime.dto.play.PlaySource;
import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.DismountResponse;
import com.ssafy.backend.realtime.dto.ride.RidePanelPayload;
import com.ssafy.backend.realtime.dto.ride.RidePlayback;
import com.ssafy.backend.realtime.dto.ride.RideResponse;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.dto.ride.RideRiderLeftPayload;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DismountResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DismountStatus;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountStatus;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.PanelSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.Ride;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.play.MusicPlayService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 따라가기를 시작한다.
 * 자격을 확인해 등록하고, 인솔자 자리로 옮긴 뒤, 어디서부터 틀면 되는지 알려준다.
 *
 * 옮길 때 지도 뷰포트에는 넣지 않는다. 그룹은 남들 화면에서 인솔자 한 점과 인원수로만 보인다.
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
	private final MusicLocationService musicLocationService;
	private final MusicPositionCalculator musicPositionCalculator;
	private final MusicPlayService musicPlayService;
	private final RidePlaybackService ridePlaybackService;
	private final RideSubscriptionService rideSubscriptionService;
	private final RideViewportService rideViewportService;
	private final RealtimeEventService realtimeEventService;
	private final RealtimeMessageService realtimeMessageService; // 인솔자에게 하차 알림

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

		// 4. 인솔자가 서 있는 곡의 자리를 계산한다.
		Spot spot = spotOf(mounted.musicId(), mounted.layer());
		Placement placement = spot.placement();

		// 5. 그 자리로 옮기되 지도에는 넣지 않는다. 서 있던 자리에서는 빠진다.
		boolean moved = presenceRedisRepository.applyRidePlacement(
				riderEmail, before.epoch(),
				before.musicId(), before.layer(), before.cellX(), before.cellY(),
				mounted.musicId(), mounted.layer(),
				placement.xNorm(), placement.yNorm(), placement.cellX(), placement.cellY());
		if (!moved) {
			log.warn("따라가기 STALE reason={}", WebSocketErrorCode.PRESENCE_STALE);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 6. 혼자 보던 화면과 주변사람 구독을 끊는다.
		//    이제부터는 인솔자가 보는 것을 옮겨 받는다. 안 끊으면 두 동네 소식이 섞여 들어온다.
		rideSubscriptionService.closeOwnViews(riderEmail, before.epoch());

		// 7. 재생 기록을 남긴다. 발견자와 만남은 남기지 않는다 —
		//    따라가는 사람이 그 곡의 발견자가 될 수 없고, 따라붙은 것은 만남이 아니다.
		long playHistoryId = musicPlayService.recordPlay(
				riderEmail, mounted.musicId(), PlaySource.FOLLOW.name());

		// 8. 서 있던 자리가 있었으면 그 자리에서 사라졌음을 알린다.
		//    지도에 다시 넣지 않으므로 이 사람에 대한 알림은 이 한 건으로 끝난다.
		notifyLeftMap(riderEmail, before);

		// 9. 인솔자가 보고 있는 화면을 한 번 보낸다.
		//    이후로는 누가 들어오고 나갔다는 변화만 오기 때문에, 여기서 안 채우면
		//    인솔자가 지도를 움직일 때까지 빈 지도를 보게 된다.
		rideViewportService.sendCurrentScreen(riderEmail, captainEmail);

		// 10. 어디서부터 틀지 읽는다. 여기서 받은 번호가 이 응답의 기준이 된다.
		RidePlayback playback = resolvePlayback(captainEmail, mounted.musicId());

		log.info("[Ride] 따라가기 시작 musicId={} layer={} snapshotSeq={}",
				mounted.musicId(), mounted.layer(), playback.snapshotSeq());
		return new RideResponse(captainEmail, playHistoryId,
				mounted.musicId(), mounted.layer(),
				spot.rawX(), spot.rawY(), placement.cellX(), placement.cellY(),
				playback.state(), playback.positionMs(), playback.snapshotSeq(),
				openPanel(captainEmail));
	}

	/**
	 * 인솔자가 지금 열어 둔 곡 상세를 읽는다.
	 *
	 * 중간에 탄 사람은 열린 순간의 알림을 못 받았다. 여기서 같이 주지 않으면
	 * 인솔자가 다시 열거나 탭을 바꿀 때까지 혼자 빈 화면을 본다.
	 *
	 * @return 열어 둔 게 없으면 닫힌 상태
	 */
	private RidePanelPayload openPanel(String captainEmail) {
		PanelSnapshot panel = rideRedisRepository.findPanel(captainEmail);
		return panel == null
				? RidePanelPayload.closed()
				: RidePanelPayload.opened(panel.musicId(), panel.tab());
	}

	/**
	 * 따라가기를 끝낸다.
	 *
	 * 내린 사람은 인솔자가 마지막으로 있던 곡에 그대로 남는다. 탑승 전 자리로 되돌리지 않는다.
	 * 듣던 곡도 끊지 않는다 — 서버는 어떤 재생 명령도 보내지 않는다.
	 * 재생 기록도 새로 만들지 않는다. 그 곡의 기록은 탈 때와 곡이 바뀔 때 이미 남았다.
	 *
	 * @return 내려서 남게 된 자리
	 * @throws CustomException 따라가는 중이 아니거나 그 사이에 상태가 바뀌었을 때
	 */
	@Transactional
	public DismountResponse dismount(String riderEmail) {
		// 1. 누구를 따라가는 중인지 읽는다. 안 따라가면 내릴 것도 없다.
		Ride ride = rideRedisRepository.findRide(riderEmail);
		if (ride == null) {
			throw new CustomException(RealtimeErrorCode.RIDE_NOT_RIDING);
		}

		// 2. 접속 번호는 지도에 나타났다고 알릴 때 쓴다.
		PresenceSnapshot presence = presenceRedisRepository.snapshot(riderEmail);
		if (presence == null || presence.epoch() == null) {
			log.warn("하차 거부 reason={}", WebSocketErrorCode.PRESENCE_NOT_CONNECTED);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 3. 등록을 지우고 지도에 다시 넣는다. 한 번에 끝난다.
		DismountResult result = rideRedisRepository.dismount(riderEmail, ride.captainEmail());
		if (result.status() == DismountStatus.NOT_RIDING) {
			throw new CustomException(RealtimeErrorCode.RIDE_NOT_RIDING);
		}
		if (result.status() != DismountStatus.OK) {
			log.info("하차 거부 reason={}", result.status());
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 4. 지도에 나타났음을 알린다. 이전 자리는 없다 — 따라가는 동안 지도에 없었기 때문이다.
		Spot spot = spotOf(result.musicId(), result.layer());
		notifyEnteredMap(riderEmail, presence.epoch(), result, spot);

		// 5. 인솔자에게 누가 내렸는지 알린다. 남은 인원도 같이 보낸다.
		realtimeMessageService.sendToUser(ride.captainEmail(), WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_RIDER_LEFT,
				new RideRiderLeftPayload(riderEmail, result.remainingRiders()));

		log.info("[Ride] 하차 musicId={} layer={} 남은인원={}",
				result.musicId(), result.layer(), result.remainingRiders());
		return new DismountResponse(result.musicId(), result.layer(),
				spot.rawX(), spot.rawY(), result.cellX(), result.cellY());
	}

	/**
	 * 지도에 나타났음을 알린다.
	 * 따라가는 동안에는 지도에 없었으므로 이전 자리는 비운다.
	 */
	private void notifyEnteredMap(
			String riderEmail, long epoch, DismountResult result, Spot spot) {
		realtimeEventService.send(new PositionChanged(
				riderEmail, epoch,
				null, result.layer(),
				null, result.musicId(),
				null, result.cellX() + ":" + result.cellY(),
				spot.placement().xNorm(), spot.placement().yNorm()));
	}

	/**
	 * 자리 계산 결과.
	 * rawX·rawY 는 지도와 같은 원시 PC 좌표고, placement 안의 값은 셀 계산용 정규화 값이다.
	 */
	private record Spot(Placement placement, double rawX, double rawY) {
	}

	/** 곡의 좌표를 그 레이어의 자리로 바꾼다. */
	private Spot spotOf(long musicId, int layer) {
		double[] pc = musicLocationService.findLocation(musicId)
				.orElseThrow(() -> {
					if (!musicLocationService.exists(musicId)) {
						return new CustomException(MusicErrorCode.MUSIC_NOT_FOUND);
					}
					log.warn("따라가기 거부 reason={}", WebSocketErrorCode.PRESENCE_LOCATION_NULL);
					return new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
				});
		Placement placement = musicPositionCalculator.calculate(pc, layer);
		return new Spot(placement, pc[placement.axisX() - 1], pc[placement.axisY() - 1]);
	}

	/**
	 * 지도에서 사라졌음을 알린다.
	 * 서 있던 자리가 없었으면(첫 배치) 알릴 것도 없다.
	 */
	private void notifyLeftMap(String riderEmail, PresenceSnapshot before) {
		if (before.musicId() == null) {
			return;
		}
		realtimeEventService.send(new PositionChanged(
				riderEmail, before.epoch(),
				before.layer(), null,
				before.musicId(), null,
				before.cellX() + ":" + before.cellY(), null,
				null, null));
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
