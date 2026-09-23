package com.ssafy.backend.realtime.service.ride;

import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.dto.ride.RideViewKind;
import com.ssafy.backend.realtime.dto.ride.RideViewPayload;
import com.ssafy.backend.realtime.dto.ride.RideViewRequest;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 인솔자가 지도를 보는 모양(기본·여정·플레이리스트·주변 탐색)을 따라가는 사람들에게 알린다.
 *
 * {@link RidePanelService} 와 같은 방식이다 — 내용은 보내지 않고 무엇을 보는지만 보낸다.
 * 받는 쪽이 그 번호로 자기가 조회한다. 조회 API 는 이미 다 있다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class RideViewService {

	private final RideRedisRepository rideRedisRepository;
	private final RideGuard rideGuard; // 따라가는 사람이 보낸 조작을 막는다
	private final RealtimeMessageService realtimeMessageService; // 따라오는 사람 개인 큐로 발송

	/**
	 * 인솔자가 지도 화면을 바꾼 것을 따라오는 사람들에게 넘긴다.
	 *
	 * @param captainEmail 조작을 보낸 사람
	 * @param request 보는 모양과 그에 필요한 번호
	 * @throws WebSocketRequestException 따라가는 사람이 보냈을 때
	 * @throws IllegalArgumentException 종류가 없거나 그 종류에 필요한 번호가 빠졌을 때
	 */
	public void relay(String captainEmail, RideViewRequest request) {
		request.validate();

		// 1. 따라가는 사람이 보낸 조작은 받지 않는다. 받으면 남의 화면을 마음대로 바꾸게 된다.
		rideGuard.requireNotRiding(captainEmail, "지도 화면을 바꿀");

		// 2. 지금 상태를 저장한다. 나중에 타는 사람은 이 값으로 같은 화면을 본다.
		//    기본 지도는 키를 지워서 나타낸다 — 곡 상세를 닫은 것과 같은 방식이다.
		//    보내기 전에 저장해야, 발송과 거의 동시에 들어온 사람도 바뀐 값을 본다.
		RideViewPayload payload = RideViewPayload.from(request);
		if (payload.kind() == RideViewKind.DEFAULT) {
			rideRedisRepository.deleteView(captainEmail);
		} else {
			rideRedisRepository.saveView(captainEmail, payload);
		}

		// 3. 따라오는 사람이 없으면 저장만 하고 끝낸다.
		Set<String> riders = rideRedisRepository.riders(captainEmail);
		if (riders.isEmpty()) {
			return;
		}

		// 4. 각자 개인 큐로 넘긴다.
		for (String rider : riders) {
			realtimeMessageService.sendToUser(rider, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.RIDE_VIEW, payload);
		}
	}

	/**
	 * 방금 탄 사람에게 인솔자가 지금 보는 화면을 한 번 보낸다.
	 *
	 * 중간에 탄 사람은 바꿨을 때의 알림을 못 받았다. 여기서 안 주면 인솔자가 다시 바꿀 때까지
	 * 기본 지도만 본다. 인솔자가 기본 지도를 보고 있으면 탄 사람도 기본이라 보낼 것이 없다.
	 *
	 * @param riderEmail 방금 탄 사람
	 * @param captainEmail 따라가는 대상
	 */
	public void sendCurrent(String riderEmail, String captainEmail) {
		try {
			RideViewPayload view = rideRedisRepository.findView(captainEmail);
			if (view == null) {
				return;
			}
			realtimeMessageService.sendToUser(riderEmail, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.RIDE_VIEW, view);
		} catch (RuntimeException e) {
			// 화면을 못 보내도 따라가기 자체는 성립한다. 인솔자가 화면을 바꾸면 곧 채워진다.
			log.warn("[Ride] 탑승 직후 인솔자 지도 화면 전달 실패", e);
		}
	}
}
