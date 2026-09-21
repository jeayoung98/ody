package com.ssafy.backend.realtime.service.ride;

import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.dto.ride.RidePanelPayload;
import com.ssafy.backend.realtime.dto.ride.RidePanelRequest;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;

import lombok.RequiredArgsConstructor;

/**
 * 인솔자가 연 곡 상세를 따라가는 사람들에게 알린다.
 *
 * 곡 번호와 탭만 보내고 상세 내용은 보내지 않는다. 받는 쪽이 평소처럼 자기가 조회한다.
 * 그래야 한 명이 조회에 실패해도 그 사람만 빈 화면이고 나머지는 멀쩡하다.
 */
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class RidePanelService {

	private final RideRedisRepository rideRedisRepository;
	private final RideGuard rideGuard; // 따라가는 사람이 보낸 조작을 막는다
	private final RealtimeMessageService realtimeMessageService; // 따라오는 사람 개인 큐로 발송

	/**
	 * 인솔자가 곡 상세를 열거나 닫거나 탭을 바꾼 것을 따라오는 사람들에게 넘긴다.
	 *
	 * @param captainEmail 조작을 보낸 사람
	 * @param request 열었는지 닫았는지와 곡·탭
	 * @throws WebSocketRequestException 따라가는 사람이 보냈을 때
	 */
	public void relay(String captainEmail, RidePanelRequest request) {
		request.validate();

		// 1. 따라가는 사람이 보낸 조작은 받지 않는다. 받으면 남의 화면을 마음대로 바꾸게 된다.
		rideGuard.requireNotRiding(captainEmail, "곡 상세를 바꿀");

		// 2. 지금 상태를 저장한다. 나중에 타는 사람은 이 값으로 같은 화면을 본다.
		//    닫은 것은 키를 지워서 나타낸다. 값으로 남겨 두면 닫힌 상태도 저장해야 한다.
		//    보내기 전에 저장해야, 발송과 거의 동시에 들어온 사람도 바뀐 값을 본다.
		RidePanelPayload payload;
		if (Boolean.TRUE.equals(request.open())) {
			rideRedisRepository.savePanel(captainEmail, request.musicId(), request.tab());
			payload = RidePanelPayload.opened(request.musicId(), request.tab());
		} else {
			rideRedisRepository.deletePanel(captainEmail);
			payload = RidePanelPayload.closed();
		}

		// 3. 따라오는 사람이 없으면 저장만 하고 끝낸다.
		Set<String> riders = rideRedisRepository.riders(captainEmail);
		if (riders.isEmpty()) {
			return;
		}

		// 4. 각자 개인 큐로 넘긴다.
		for (String rider : riders) {
			realtimeMessageService.sendToUser(rider, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.RIDE_PANEL, payload);
		}
	}
}
