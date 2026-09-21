package com.ssafy.backend.realtime.service.ride;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;

import lombok.RequiredArgsConstructor;

/**
 * 따라가는 중에는 스스로 조작할 수 없게 막는다.
 *
 * 막지 않으면 따라가는 사람의 조작이 자기 자리를 바꿔 인솔자와 어긋난 상태가 된다.
 * 예를 들어 레이어를 옮기면 인솔자는 3층에 있는데 자기는 5층에 서 있게 된다.
 *
 * 막는 곳이 여섯 군데라 "지금 따라가는 중인가"를 묻는 일은 여기 한 곳에 둔다.
 * 조용히 넘기지 않고 반드시 오류를 돌려준다. 안 그러면 받는 쪽이
 * 막힌 것인지 요청이 사라진 것인지 구분할 수 없다.
 */
@Component
@Profile("realtime")
@RequiredArgsConstructor
public class RideGuard {

	private final RideRedisRepository rideRedisRepository;

	/** 지금 누군가를 따라가는 중인지 본다. */
	public boolean isRiding(String email) {
		return rideRedisRepository.findRide(email) != null;
	}

	/**
	 * 소켓으로 온 조작을 막는다.
	 *
	 * @param email 보낸 사람
	 * @param action 막힌 동작 이름. 오류 메시지에 그대로 들어간다
	 * @throws WebSocketRequestException 따라가는 중일 때
	 */
	public void requireNotRiding(String email, String action) {
		if (isRiding(email)) {
			throw new WebSocketRequestException(WebSocketErrorCode.RIDE_NOT_CAPTAIN,
					"따라가는 중에는 " + action + " 수 없다");
		}
	}

	/**
	 * REST 로 온 조작을 막는다.
	 *
	 * @param email 보낸 사람
	 * @throws CustomException 따라가는 중일 때
	 */
	public void requireNotRidingOnRest(String email) {
		if (isRiding(email)) {
			throw new CustomException(RealtimeErrorCode.RIDE_NOT_CAPTAIN);
		}
	}
}
