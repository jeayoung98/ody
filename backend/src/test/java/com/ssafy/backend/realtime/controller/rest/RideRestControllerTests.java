package com.ssafy.backend.realtime.controller.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RideRequest;
import com.ssafy.backend.realtime.dto.ride.RideResponse;
import com.ssafy.backend.realtime.service.ride.RideService;

/** 따라가기가 토큰의 이메일 기준으로 처리되는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RideRestControllerTests {

	private static final String RIDER = "rider@x.com";
	private static final String CAPTAIN = "captain@x.com";

	@Mock RideService rideService;
	@InjectMocks RideRestController controller;

	@Test
	@DisplayName("따라가는 사람은 토큰에서, 따라갈 사람은 본문에서 가져온다")
	void ridePassesPrincipalAndBody() {
		RideResponse response = new RideResponse(
				CAPTAIN, 77L, 10877L, 3, -1.25, 1.2, 7, 5, PlaybackState.PLAYING, 42_000L, 4L);
		when(rideService.mount(RIDER, CAPTAIN)).thenReturn(response);

		ApiResponse<RideResponse> result =
				controller.ride(new RideRequest(CAPTAIN), () -> RIDER);

		assertThat(result.data()).isEqualTo(response);
	}
}
