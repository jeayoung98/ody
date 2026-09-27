package com.ssafy.backend.realtime.service.ride;

import java.util.Collection;
import java.util.Map;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.dto.viewport.ViewportCellCounts;
import com.ssafy.backend.realtime.dto.viewport.ViewportBulkEnter;
import com.ssafy.backend.realtime.dto.viewport.ViewportDelta;
import com.ssafy.backend.realtime.dto.viewport.ViewportRiderCount;
import com.ssafy.backend.realtime.dto.viewport.ViewportSnapshot;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ViewportMeta;
import com.ssafy.backend.realtime.service.viewport.ViewportService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 인솔자가 보는 지도를 따라오는 사람들에게 그대로 옮긴다.
 *
 * 사람마다 다시 만들지 않고 인솔자에게 보낸 것을 그대로 보낸다.
 * 다시 만들면 인원수만큼 조회가 늘고, 무엇보다 같은 순간에 서로 다른 화면을 보게 된다.
 *
 * 옮기는 것은 네 가지다 — 화면 목록, 누가 들어오고 나가고 움직인 알림, 자리별 사람 수.
 * 목록만 옮기면 인솔자가 지도를 가만히 둔 동안 나간 사람이 계속 떠 있게 된다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class RideViewportService {

	private final RideRedisRepository rideRedisRepository; // 따라오는 사람 명단
	private final ViewportRedisRepository viewportRedisRepository; // 인솔자가 열어 둔 화면
	private final ViewportService viewportService; // 저장된 화면으로 목록 만들기
	private final RealtimeMessageService realtimeMessageService; // 개인 큐 발송

	/**
	 * 인솔자가 받은 화면 목록을 따라오는 사람들에게 그대로 보낸다.
	 *
	 * @param captainEmail 화면을 연 사람. 따라오는 사람이 없으면 아무 일도 없다
	 * @param snapshot 인솔자에게 보낸 것과 같은 목록
	 */
	public void mirrorSnapshot(String captainEmail, ViewportSnapshot snapshot) {
		if (snapshot == null) {
			return;
		}
		send(rideRedisRepository.riders(captainEmail), RealtimeMessageType.RIDE_VIEWPORT, snapshot);
	}

	/**
	 * 방금 탄 사람에게 인솔자가 보고 있는 화면을 한 번 보낸다.
	 *
	 * 탄 뒤로 받는 것은 "누가 들어왔다", "누가 나갔다" 같은 변화만 받음 (델타).
	 * 처음 지도가 비어 있는 상태에서 변화만 받으면 아무도 못 그린다.
	 * 전체 목록은 인솔자가 지도를 움직일 때만 오는데, 인솔자가 가만히 있으면
	 * 그때까지 계속 빈 지도를 보게 된다. 그래서 여기서 한 번 채워 준다.
	 *
	 * @param riderEmail 방금 탄 사람
	 * @param captainEmail 따라가는 대상
	 */
	public void sendCurrentScreen(String riderEmail, String captainEmail) {
		// 1. 인솔자가 화면을 연 적이 없으면 보낼 것도 없다.
		ViewportMeta meta = viewportRedisRepository.findMeta(captainEmail).orElse(null);
		if (meta == null) {
			return;
		}

		// 2. 인솔자 기준으로 목록을 만든다.
		//    목록에는 만든 사람 본인이 빠진다. 인솔자로 만들어야 인솔자가 보는 것과 같아진다.
		//    인솔자가 이미 열어 둔 화면이라 구독은 건드리지 않는다.
		try {
			ViewportSnapshot snapshot = viewportService.createSnapshot(
					captainEmail, meta.mode(), meta.requestSeq(), meta.viewport());
			realtimeMessageService.sendToUser(riderEmail, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.RIDE_VIEWPORT, snapshot);
		} catch (RuntimeException e) {
			// 화면을 못 보내도 따라가기 자체는 성립한다. 인솔자가 지도를 움직이면 곧 채워진다.
			log.warn("[Ride] 탑승 직후 인솔자 화면 전달 실패", e);
		}
	}

	/**
	 * 인솔자가 받은 자리별 사람 수를 따라오는 사람들에게 그대로 보낸다.
	 *
	 * @param captainEmail 넓은 화면을 보고 있는 사람
	 * @param counts 인솔자에게 보낸 것과 같은 내용
	 */
	public void mirrorCellCounts(String captainEmail, ViewportCellCounts counts) {
		if (counts == null) {
			return;
		}
		send(rideRedisRepository.riders(captainEmail),
				RealtimeMessageType.RIDE_VIEWPORT_CELL_COUNTS, counts);
	}

	/**
	 * 여러 사람을 한 번에 물어 각자를 따라오는 사람들을 읽는다.
	 *
	 * 화면 변화 알림은 수신자가 여럿이라 한 명씩 물으면 그 왕복이 그대로 지연이 된다.
	 * 보내기 전에 한 번 물어 두고 쓴다.
	 *
	 * @param captainEmails 알림을 받을 사람들
	 * @return 따라오는 사람이 있는 사람만 담긴 결과
	 */
	public Map<String, Set<String>> ridersOf(Collection<String> captainEmails) {
		return rideRedisRepository.ridersOf(captainEmails);
	}

	/**
	 * 인솔자가 받은 화면 변화 알림을 따라오는 사람들에게 그대로 보낸다.
	 *
	 * @param riders 미리 읽어 둔 따라오는 사람들. 없으면 아무 일도 없다
	 * @param viewportType 인솔자에게 보낸 알림 종류
	 * @param delta 인솔자에게 보낸 것과 같은 내용
	 */
	public void mirrorDelta(
			Set<String> riders, RealtimeMessageType viewportType, ViewportDelta delta) {
		RealtimeMessageType rideType = toRideType(viewportType);
		if (rideType == null || delta == null) {
			return;
		}
		send(riders, rideType, delta);
	}

	/**
	 * 여러 사람이 한꺼번에 나타난 것을 따라가는 사람에게도 그대로 넘긴다.
	 *
	 * 인솔자가 보는 것과 같은 화면이어야 하므로, 인솔자에게 간 것을 그대로 보낸다.
	 *
	 * @param riders 인솔자를 따라가는 사람들
	 * @param payload 인솔자에게 보낸 것과 같은 내용
	 */
	public void mirrorBulkEnter(Set<String> riders, ViewportBulkEnter payload) {
		if (payload == null) {
			return;
		}
		send(riders, RealtimeMessageType.RIDE_VIEWPORT_BULK_ENTER, payload);
	}

	/**
	 * 따라오는 인원수 변화도 따라가는 사람에게 그대로 넘긴다.
	 *
	 * @param riders 인솔자를 따라가는 사람들
	 * @param payload 인솔자에게 보낸 것과 같은 내용
	 */
	public void mirrorRiderCount(Set<String> riders, ViewportRiderCount payload) {
		if (payload == null) {
			return;
		}
		send(riders, RealtimeMessageType.RIDE_VIEWPORT_RIDER_COUNT, payload);
	}

	/**
	 * 혼자 보는 알림 종류를 따라가는 사람용 종류로 바꾼다.
	 * 내용은 같고 이름만 다르다. 받는 쪽이 자기 화면 요청의 답과 헷갈리지 않게 하려는 것이다.
	 *
	 * @return 옮길 수 없는 종류면 null
	 */
	private static RealtimeMessageType toRideType(RealtimeMessageType viewportType) {
		if (viewportType == null) {
			return null;
		}
		return switch (viewportType) {
			case VIEWPORT_ENTER -> RealtimeMessageType.RIDE_VIEWPORT_ENTER;
			case VIEWPORT_MOVE -> RealtimeMessageType.RIDE_VIEWPORT_MOVE;
			case VIEWPORT_LEAVE -> RealtimeMessageType.RIDE_VIEWPORT_LEAVE;
			default -> null;
		};
	}

	/**
	 * 따라오는 사람들에게 같은 내용을 보낸다.
	 *
	 * @param riders 따라오는 사람들
	 * @param type 보낼 메시지 종류
	 * @param payload 인솔자에게 보낸 것과 같은 내용
	 */
	private void send(Set<String> riders, RealtimeMessageType type, Object payload) {
		if (riders == null || riders.isEmpty()) {
			return;
		}
		for (String rider : riders) {
			realtimeMessageService.sendToUser(
					rider, WebSocketDestination.QUEUE_PRESENCE, type, payload);
		}
	}
}
