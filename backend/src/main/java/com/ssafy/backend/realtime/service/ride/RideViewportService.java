package com.ssafy.backend.realtime.service.ride;

import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.dto.viewport.ViewportSnapshot;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;

import lombok.RequiredArgsConstructor;

/**
 * 인솔자가 보는 지도를 따라오는 사람들에게 그대로 옮긴다.
 *
 * 사람마다 다시 만들지 않고 인솔자에게 보낸 것을 그대로 보낸다.
 * 다시 만들면 인원수만큼 조회가 늘고, 무엇보다 같은 순간에 서로 다른 화면을 보게 된다.
 */
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class RideViewportService {

	private final RideRedisRepository rideRedisRepository; // 따라오는 사람 명단
	private final RealtimeMessageService realtimeMessageService; // 개인 큐 발송

	/**
	 * 인솔자가 받은 화면 목록을 따라오는 사람들에게 그대로 보낸다. (무엇을 보낼지 정함)
	 *
	 * @param captainEmail 화면을 연 사람. 따라오는 사람이 없으면 아무 일도 없다
	 * @param snapshot 인솔자에게 보낸 것과 같은 목록
	 */
	public void mirrorSnapshot(String captainEmail, ViewportSnapshot snapshot) {
		if (snapshot == null) {
			return;
		}
		mirror(captainEmail, RealtimeMessageType.RIDE_VIEWPORT, snapshot);
	}

	/**
	 * 따라오는 사람들에게 같은 내용을 보낸다. (누구에게 보낼지)
	 *
	 * @param captainEmail 인솔자
	 * @param type 보낼 메시지 종류
	 * @param payload 인솔자에게 보낸 것과 같은 내용
	 */
	private void mirror(String captainEmail, RealtimeMessageType type, Object payload) {
		Set<String> riders = rideRedisRepository.riders(captainEmail);
		if (riders.isEmpty()) {
			return;
		}
		for (String rider : riders) {
			realtimeMessageService.sendToUser(
					rider, WebSocketDestination.QUEUE_PRESENCE, type, payload);
		}
	}
}
