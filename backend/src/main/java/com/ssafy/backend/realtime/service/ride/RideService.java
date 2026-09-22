package com.ssafy.backend.realtime.service.ride;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.realtime.dto.play.PlaySource;
import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.DisbandResponse;
import com.ssafy.backend.realtime.dto.ride.DismountResponse;
import com.ssafy.backend.realtime.dto.ride.RideEndReason;
import com.ssafy.backend.realtime.dto.ride.RideEndedPayload;
import com.ssafy.backend.realtime.dto.ride.RidePanelPayload;
import com.ssafy.backend.realtime.dto.ride.RidePlayback;
import com.ssafy.backend.realtime.dto.ride.RideResponse;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.dto.ride.RideRiderJoinedPayload;
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
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DisbandResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DismountResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DismountStatus;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountStatus;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.PanelSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.Ride;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.RiderLeaveResult;
import com.ssafy.backend.realtime.service.meeting.MeetingService;
import com.ssafy.backend.realtime.service.nearby.NearbyChangeService;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.play.MusicPlayService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

import com.ssafy.backend.realtime.service.viewport.ViewportDeltaService;

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
	private final MeetingService meetingService; // 하차 시점 만남 기록
	private final ViewportDeltaService viewportDeltaService; // 해체를 한 덩어리로 알림
	private final NearbyChangeService nearbyChangeService; // 해체를 주변사람 목록에도 알림
	private final UserDisplayService userDisplayService; // 탑승 알림에 실을 이름

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

		// 여기서부터는 등록이 이미 끝나 있다. 아래에서 터지면 등록만 남아
		// "따라가는 중인데 지도에도 있는" 상태가 되므로 되돌린다.
		boolean placed = false;
		try {
			// 4. 인솔자가 서 있는 곡의 자리를 계산한다.
			Spot spot = spotOf(mounted.musicId(), mounted.layer());
			Placement placement = spot.placement();

			// 5. 그 자리로 옮기되 지도에는 넣지 않는다. 서 있던 자리에서는 빠진다.
			placed = presenceRedisRepository.applyRidePlacement(
					riderEmail, before.epoch(),
					before.musicId(), before.layer(), before.cellX(), before.cellY(),
					mounted.musicId(), mounted.layer(),
					placement.xNorm(), placement.yNorm(), placement.cellX(), placement.cellY());
			if (!placed) {
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

			// 10. 인솔자에게 누가 탔는지 알린다. 인솔자가 인원수를 아는 유일한 길이다.
			//     아래 11번은 인솔자 자리를 보는 사람들에게 가는 것이라 인솔자 본인은 빠진다.
			int riderCount = rideRedisRepository.riderCount(captainEmail);
			notifyQuietly("탑승 인솔자 알림", () -> realtimeMessageService.sendToUser(
					captainEmail, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.RIDE_RIDER_JOINED,
					new RideRiderJoinedPayload(
							riderEmail, userDisplayService.find(riderEmail).nickname(), riderCount)));

			// 11. 인솔자를 보고 있는 사람들에게 인원수가 늘었다고 알린다.
			notifyRiderCount(captainEmail, riderCount);

			// 12. 어디서부터 틀지 읽는다. 여기서 받은 번호가 이 응답의 기준이 된다.
			RidePlayback playback = resolvePlayback(captainEmail, mounted.musicId());

			log.info("[Ride] 따라가기 시작 musicId={} layer={} snapshotSeq={}",
					mounted.musicId(), mounted.layer(), playback.snapshotSeq());
			return new RideResponse(captainEmail, playHistoryId,
					mounted.musicId(), mounted.layer(),
					spot.rawX(), spot.rawY(), placement.cellX(), placement.cellY(),
					playback.state(), playback.positionMs(), playback.snapshotSeq(),
					openPanel(captainEmail));
		} catch (RuntimeException e) {
			undoMount(riderEmail, captainEmail, placed);
			throw e;
		}
	}

	/**
	 * 따라오는 인원수가 바뀌었다고 인솔자를 보고 있는 사람들에게 알린다.
	 *
	 * 남들 화면에서 선단은 인솔자 한 점이고, 몇 명이 붙어 있는지가 선단임을 아는 유일한
	 * 표시다. 그런데 그 숫자는 인솔자가 곡을 바꿀 때만 갱신됐다. 스무 명이 타고 내려도
	 * 구경하는 쪽에는 계속 같은 수로 보인다.
	 *
	 * 인솔자가 지도에 없으면 보여 줄 자리가 없으니 아무것도 하지 않는다.
	 *
	 * @param captainEmail 인원수가 바뀐 인솔자
	 * @param riderCount 바뀐 뒤의 인원수
	 */
	private void notifyRiderCount(String captainEmail, int riderCount) {
		PresenceSnapshot captain = presenceRedisRepository.snapshot(captainEmail);
		if (captain == null || captain.musicId() == null || captain.layer() == null) {
			return;
		}
		String cell = captain.cellX() + ":" + captain.cellY();
		notifyQuietly("인원수 화면 알림", () -> viewportDeltaService.sendRiderCount(
				captainEmail, captain.layer(), captain.musicId(), cell, riderCount));
		notifyQuietly("인원수 주변사람 알림", () -> nearbyChangeService.sendRiderCount(
				captainEmail, captain.layer(), captain.musicId(), riderCount));
	}

	/**
	 * 알림 한 건이 실패해도 나머지를 막지 않게 감싼다.
	 *
	 * 여기까지 왔으면 Redis 는 이미 바뀐 뒤다. 알림 하나가 터졌다고 나머지를 건너뛰면
	 * 상태는 바뀌었는데 아무도 모르는 쪽이 늘어난다.
	 *
	 * @param what 실패했을 때 로그에 남길 이름
	 */
	private void notifyQuietly(String what, Runnable action) {
		try {
			action.run();
		} catch (RuntimeException e) {
			log.warn("[Ride] {} 실패 — 상태는 이미 바뀌었다", what, e);
		}
	}

	/**
	 * 등록만 해 놓고 뒤에서 실패한 따라가기를 되돌린다.
	 *
	 * 자리를 이미 옮겼는지에 따라 되돌리는 방법이 다르다. 옮기기 전이면 아직 지도에 있으므로
	 * 등록만 지우면 되고, 옮긴 뒤면 지도에서 빠져 있으므로 다시 넣어야 한다.
	 * 반대로 하면 지도에 두 번 들어가 그 자리 인원수가 하나 늘어난 채 남는다.
	 *
	 * 화면과 주변사람 구독은 되살리지 않는다. 실패를 받은 쪽이 다시 요청한다.
	 *
	 * @param placed 자리를 이미 옮겼으면 true
	 */
	private void undoMount(String riderEmail, String captainEmail, boolean placed) {
		try {
			if (placed) {
				rideRedisRepository.dismount(riderEmail, captainEmail);
			} else {
				rideRedisRepository.riderLeave(riderEmail);
			}
		} catch (RuntimeException e) {
			// 되돌리기까지 실패하면 등록이 남는다. 접속이 끊길 때 정리된다.
			log.warn("따라가기 되돌리기 실패 — 등록이 남을 수 있다", e);
		}
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
			// 접속이 없는 것과 상태가 어긋난 것은 받는 쪽이 할 일이 다르다.
			// 앞은 다시 연결해야 하고, 뒤는 화면을 새로 고치면 된다.
			throw new CustomException(result.status() == DismountStatus.NOT_CONNECTED
					? RealtimeErrorCode.PRESENCE_ERROR
					: RealtimeErrorCode.RIDE_STALE);
		}

		// 4. 만남에서 뺄 명단을 만든다. 인솔자 + 남은 동료 + 나 자신이다.
		//    남은 동료는 스크립트가 등록을 지운 뒤에 읽어 준 것이라, 자바에서 따로 읽을 때처럼
		//    그 사이에 새로 탄 사람이 빠지는 일이 없다.
		Set<String> fleetMembers = new LinkedHashSet<>(result.remainingMates());
		fleetMembers.add(ride.captainEmail());
		fleetMembers.add(riderEmail);

		// 5. 지도에 나타났음을 알린다. 이전 자리는 없다 — 따라가는 동안 지도에 없었기 때문이다.
		Spot spot = spotOf(result.musicId(), result.layer());
		notifyQuietly("하차 지도 등장 알림",
				() -> notifyEnteredMap(riderEmail, presence.epoch(), result, spot));

		// 6. 인솔자에게 누가 내렸는지 알린다. 남은 인원도 같이 보낸다.
		notifyQuietly("하차 인솔자 알림", () -> realtimeMessageService.sendToUser(
				ride.captainEmail(), WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_RIDER_LEFT,
				new RideRiderLeftPayload(riderEmail, result.remainingRiders())));

		// 7. 인솔자를 보고 있는 사람들에게 인원수가 줄었다고 알린다.
		notifyRiderCount(ride.captainEmail(), result.remainingRiders());

		// 8. 만남을 센다. 내리는 순간 보통 사용자가 되므로 그 곡에 원래 있던 사람과는 만남이다.
		//    명단은 지도에 다시 들어가기 전에 찍힌 것이라 자기 자신이 섞여 있지 않다.
		notifyQuietly("하차 만남 기록", () ->
				meetingService.recordOnDismount(List.of(riderEmail), result.residents(), fleetMembers));

		log.info("[Ride] 하차 musicId={} layer={} 남은인원={}",
				result.musicId(), result.layer(), result.remainingRiders());
		return new DismountResponse(result.musicId(), result.layer(),
				spot.rawX(), spot.rawY(), result.cellX(), result.cellY());
	}

	/**
	 * 접속이 끊기거나 만료된 사람을 따라가기에서 정리한다.
	 *
	 * 그 사람이 인솔자면 선단을 해제하고, 따라가던 사람이면 그 사람만 뺀다.
	 * 둘 다 아니면 아무 일도 없다.
	 *
	 * 나가는 길이 연결 종료와 접속 만료 둘인데, 둘 다 여기로 들어온다.
	 *
	 * @param email 사라진 사람
	 */
	public void onUserGone(String email) {
		// 사라진 경우다. 여기서 거부를 던지면 뒤따르는 정리가 통째로 멈춘다 — 인솔자도
		// 따라가던 사람도 아니었던 사람이 끊길 때마다 그렇게 된다. 그래서 조용히 끝나는 쪽을 쓴다.
		disband(email, RideEndReason.CAPTAIN_LEFT);
		leaveRide(email);
	}

	/**
	 * 따라가던 사람이 사라졌다. 그 사람만 빼고 선단은 유지한다.
	 *
	 * 지도에 다시 넣지 않는다. 스스로 내린 것이 아니라 사라진 것이라 넣으면 유령이 된다.
	 * 인솔자에게는 스스로 내렸을 때와 같은 알림을 보낸다 — 인솔자가 할 일이 같기 때문이다.
	 *
	 * @param riderEmail 사라진 사람
	 */
	private void leaveRide(String riderEmail) {
		RiderLeaveResult result = rideRedisRepository.riderLeave(riderEmail);
		if (result == null) {
			return; // 따라가는 중이 아니었다
		}
		realtimeMessageService.sendToUser(result.captainEmail(), WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_RIDER_LEFT,
				new RideRiderLeftPayload(riderEmail, result.remainingRiders()));
		notifyRiderCount(result.captainEmail(), result.remainingRiders());
		log.info("[Ride] 따라가던 사람 이탈 남은인원={}", result.remainingRiders());
	}

	/**
	 * 인솔자가 스스로 선단을 푼다.
	 *
	 * 따라오던 사람이 없으면 인솔자가 아니므로 거부한다. 이때 스크립트를 부르기 전에
	 * 인원을 먼저 세는 것이 중요하다 — 스크립트는 인원이 0 이어도 재생 정보와 열어 둔 곡 상세를
	 * 지운다. 사라진 사람에게는 맞지만, 살아 있는 인솔자에게는 나중에 타는 사람이 곡을
	 * 처음부터 듣게 되는 손해다.
	 *
	 * @param captainEmail 선단을 푸는 인솔자
	 * @return 내린 인원과 그 사람들이 남은 자리
	 * @throws CustomException 따라오는 사람이 없으면 거부한다
	 */
	@Transactional
	public DisbandResponse disbandByCaptain(String captainEmail) {
		if (rideRedisRepository.riderCount(captainEmail) == 0) {
			log.info("해체 거부 reason={}", RealtimeErrorCode.RIDE_NOT_CAPTAIN);
			throw new CustomException(RealtimeErrorCode.RIDE_NOT_CAPTAIN);
		}

		DisbandResult result = disband(captainEmail, RideEndReason.CAPTAIN_ENDED);
		if (!result.hadRiders()) {
			// 세고 나서 부르는 사이에 전원이 내렸다. 푼 것이 없으니 인솔자가 아닌 것과 같다.
			log.info("해체 거부 reason={} 사유=사이에 전원이 내렸다", RealtimeErrorCode.RIDE_NOT_CAPTAIN);
			throw new CustomException(RealtimeErrorCode.RIDE_NOT_CAPTAIN);
		}
		return new DisbandResponse(result.riders().size(), result.musicId(), result.layer());
	}

	/**
	 * 선단을 해제한다.
	 *
	 * 따라가던 사람은 전원 내리고, 인솔자가 마지막으로 있던 곡에 그대로 남는다.
	 * 듣던 곡은 끊기지 않는다. 스스로 내렸을 때와 결과가 같다.
	 *
	 * 들어오는 길이 셋이다 — 인솔자가 창을 닫든, 접속이 만료되든, 스스로 풀든 여기로 온다.
	 * 길을 나누면 한쪽만 고쳐진다. 다른 것은 받는 쪽에 실어 보내는 사유뿐이다.
	 *
	 * 여기서는 아무것도 던지지 않는다. 끊김 정리 중에 불리는 자리라, 거부를 던지면
	 * 그 뒤의 정리가 멈춘다. 거부가 필요한 쪽은 {@link #disbandByCaptain(String)} 이 맡는다.
	 *
	 * @param captainEmail 선단의 인솔자
	 * @param reason 받는 사람에게 알릴 끝난 이유
	 * @return 해제 결과. 따라오던 사람이 없었으면 빈 결과
	 */
	public DisbandResult disband(String captainEmail, RideEndReason reason) {
		// 1. 등록을 지우고 전원을 지도에 다시 넣는다. 한 번에 끝난다.
		//    누가 따라가고 있었는지도 스크립트가 같이 돌려준다. 자바에서 따로 읽으면
		//    그 사이에 새로 탄 사람이 명단에서 빠져 같은 선단인데 만남으로 세어진다.
		DisbandResult result = rideRedisRepository.disband(captainEmail);
		if (!result.hadRiders()) {
			return result; // 따라오던 사람이 없었다. 남아 있던 키는 스크립트가 이미 지웠다
		}
		if (result.musicId() <= 0) {
			// 아무도 서 있는 자리를 갖고 있지 않았다. 등록은 지웠지만 어디에 남았다고
			// 알릴 자리가 없다. 여기까지 온 것 자체가 이상하므로 남겨 둔다.
			log.warn("[Ride] 선단 해체 — 돌아갈 자리를 찾지 못했다 인원={}", result.riders().size());
			return result;
		}

		// 2. 만남에서 뺄 명단은 따라가던 전원에 인솔자를 더한 것이다.
		//    그 곡에 원래 있던 사람들과는 다른 명단이다.
		Set<String> fleetMembers = new LinkedHashSet<>(result.riders());
		fleetMembers.add(captainEmail);

		// 3. 따라가던 사람에게 끝났다고 알린다. 남게 된 자리는 스스로 내렸을 때와 같은 모양이다.
		//    지도에 못 돌아간 사람에게도 보낸다. 끝난 것은 그 사람도 마찬가지다.
		Spot spot = spotOf(result.musicId(), result.layer());
		RideEndedPayload ended = new RideEndedPayload(
				captainEmail, reason,
				result.musicId(), result.layer(),
				spot.rawX(), spot.rawY(), result.cellX(), result.cellY());
		for (String rider : result.riders()) {
			notifyQuietly("해체 알림", () -> realtimeMessageService.sendToUser(
					rider, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.RIDE_ENDED, ended));
		}

		// 4. 남들 화면에는 한 덩어리로 알린다. 한 명씩 보내면 그 수만큼 다시 그린다.
		notifyQuietly("해체 화면 알림", () ->
				viewportDeltaService.sendBulkEnter(result.leftRiders(), result.layer(),
						result.musicId(), result.cellX() + ":" + result.cellY()));

		// 5. 주변사람 목록에도 알린다. 해체는 위치 변경 알림을 거치지 않아
		//    이걸 안 보내면 패널을 열어 둔 사람의 목록에 이 사람들이 끝내 안 나타난다.
		notifyQuietly("해체 주변사람 알림", () ->
				nearbyChangeService.sendEnteredTogether(result.leftRiders(), result.layer(), result.musicId()));

		// 6. 만남을 센다. 그 곡에 원래 있던 사람들 중 선단이 아닌 사람하고만 센다.
		//    한 명이 스스로 내릴 때와 같은 함수다. 두 벌로 두면 한쪽만 고쳐진다.
		notifyQuietly("해체 만남 기록", () ->
				meetingService.recordOnDismount(result.leftRiders(), result.residents(), fleetMembers));

		log.info("[Ride] 선단 해체 사유={} musicId={} layer={} 내린인원={}",
				reason, result.musicId(), result.layer(), result.leftRiders().size());
		return result;
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
			// STALE 은 읽은 뒤에 접속 번호가 바뀐 것이다. 화면을 새로 고치면 풀린다.
			default -> RealtimeErrorCode.RIDE_STALE;
		};
	}
}
