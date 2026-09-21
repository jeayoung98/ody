package com.ssafy.backend.realtime.controller.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;
import com.ssafy.backend.realtime.service.ride.RideGuard;

/** 주변사람 목록이 로그인 사용자 기준으로만 조회되는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class NearbyRestControllerTests {

	private static final String EMAIL = "user@x.com";

	@Mock NearbyPeopleService nearbyPeopleService;
	@Mock RideGuard rideGuard;
	@InjectMocks NearbyRestController controller;

	@Test
	@DisplayName("주변사람 목록은 토큰의 이메일로 조회한다")
	void nearbyUsesPrincipalEmail() {
		NearbySnapshot snapshot = new NearbySnapshot(8812L, 41L, List.of());
		when(nearbyPeopleService.open(EMAIL)).thenReturn(snapshot);

		ApiResponse<NearbySnapshot> result = controller.nearby(() -> EMAIL);

		assertThat(result.data()).isEqualTo(snapshot);
	}

	// 인증 없이 부른 경우는 여기서 보지 않는다. 필터 체인이 먼저 401 을 내주므로
	// 컨트롤러까지 오지 않는다. 그 검증은 SecurityPolicyTests 가 필터 체인째로 한다.

	/** 주변 사람은 내가 듣는 곡 기준이라, 따라가는 동안 열면 화면이 섞인다. */
	@Test
	@DisplayName("따라가는 중이면 주변 사람 열기를 거부한다")
	void ridingCannotOpenNearby() {
		org.mockito.Mockito.doThrow(new CustomException(RealtimeErrorCode.RIDE_NOT_CAPTAIN))
				.when(rideGuard).requireNotRidingOnRest(EMAIL);

		assertThatThrownBy(() -> controller.nearby(() -> EMAIL))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.RIDE_NOT_CAPTAIN));

		org.mockito.Mockito.verifyNoInteractions(nearbyPeopleService);
	}
}
