package com.ssafy.backend.realtime.service.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.Ride;

/** 따라가는 중인 사람의 조작이 막히는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RideGuardTests {

	private static final String RIDER = "rider@x.com";
	private static final String CAPTAIN = "captain@x.com";

	@Mock RideRedisRepository rideRedisRepository;
	@InjectMocks RideGuard guard;

	@Test
	@DisplayName("따라가는 중이면 그렇다고 알려준다")
	void tellsWhetherRiding() {
		when(rideRedisRepository.findRide(RIDER)).thenReturn(new Ride(CAPTAIN, 7L));
		when(rideRedisRepository.findRide(CAPTAIN)).thenReturn(null);

		assertThat(guard.isRiding(RIDER)).isTrue();
		assertThat(guard.isRiding(CAPTAIN)).isFalse();
	}

	/** 조용히 넘기면 받는 쪽이 막힌 것인지 요청이 사라진 것인지 모른다. */
	@Test
	@DisplayName("소켓 조작은 따라가는 중이면 오류로 막는다")
	void blocksSocketWhileRiding() {
		when(rideRedisRepository.findRide(RIDER)).thenReturn(new Ride(CAPTAIN, 7L));

		assertThatThrownBy(() -> guard.requireNotRiding(RIDER, "화면을 바꿀"))
				.isInstanceOf(WebSocketRequestException.class)
				.extracting(e -> ((WebSocketRequestException) e).getCode())
				.isEqualTo(WebSocketErrorCode.RIDE_NOT_CAPTAIN);
	}

	@Test
	@DisplayName("막힌 동작 이름이 오류 메시지에 들어간다")
	void messageNamesTheAction() {
		when(rideRedisRepository.findRide(RIDER)).thenReturn(new Ride(CAPTAIN, 7L));

		assertThatThrownBy(() -> guard.requireNotRiding(RIDER, "주변 사람을 열"))
				.hasMessageContaining("주변 사람을 열");
	}

	@Test
	@DisplayName("REST 조작은 따라가는 중이면 오류로 막는다")
	void blocksRestWhileRiding() {
		when(rideRedisRepository.findRide(RIDER)).thenReturn(new Ride(CAPTAIN, 7L));

		assertThatThrownBy(() -> guard.requireNotRidingOnRest(RIDER))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.RIDE_NOT_CAPTAIN));
	}

	@Test
	@DisplayName("따라가는 중이 아니면 그대로 통과시킨다")
	void passesWhenNotRiding() {
		when(rideRedisRepository.findRide(CAPTAIN)).thenReturn(null);

		assertThatCode(() -> guard.requireNotRiding(CAPTAIN, "화면을 바꿀")).doesNotThrowAnyException();
		assertThatCode(() -> guard.requireNotRidingOnRest(CAPTAIN)).doesNotThrowAnyException();
	}
}
