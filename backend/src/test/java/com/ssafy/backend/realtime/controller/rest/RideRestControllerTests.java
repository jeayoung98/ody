package com.ssafy.backend.realtime.controller.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RideRequest;
import com.ssafy.backend.realtime.dto.ride.RidePanelPayload;
import com.ssafy.backend.realtime.dto.ride.RideRankingItem;
import com.ssafy.backend.realtime.dto.ride.RideResponse;
import com.ssafy.backend.realtime.service.ride.RideRankingService;
import com.ssafy.backend.realtime.service.ride.RideService;

/** 따라가기가 토큰의 이메일 기준으로 처리되는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RideRestControllerTests {

	private static final String RIDER = "rider@x.com";
	private static final String CAPTAIN = "captain@x.com";

	@Mock RideService rideService;
	@Mock RideRankingService rideRankingService;
	@InjectMocks RideRestController controller;

	@Test
	@DisplayName("따라가는 사람은 토큰에서, 따라갈 사람은 본문에서 가져온다")
	void ridePassesPrincipalAndBody() {
		RideResponse response = new RideResponse(
				CAPTAIN, 77L, 10877L, 3, -1.25, 1.2, 7, 5, PlaybackState.PLAYING, 42_000L, 4L,
				RidePanelPayload.closed());
		when(rideService.mount(RIDER, CAPTAIN)).thenReturn(response);

		ApiResponse<RideResponse> result =
				controller.ride(new RideRequest(CAPTAIN), () -> RIDER);

		assertThat(result.data()).isEqualTo(response);
	}

	/** 누가 물어도 같은 답이라 토큰의 이메일을 넘기지 않는다. */
	@Test
	@DisplayName("랭킹은 요청한 사람과 무관하게 만든 목록을 그대로 준다")
	void rankingPassesOnlyLimit() {
		List<RideRankingItem> top = List.of(
				new RideRankingItem(1, CAPTAIN, "인솔자", null, 7));
		when(rideRankingService.top(10)).thenReturn(top);

		ApiResponse<List<RideRankingItem>> result = controller.ranking(10);

		assertThat(result.data()).isEqualTo(top);
	}

	/** 아무도 안 태우고 있는 상태다. 오류가 아니라 빈 목록이어야 한다. */
	@Test
	@DisplayName("빈 목록도 그대로 내보낸다")
	void rankingPassesEmptyList() {
		when(rideRankingService.top(10)).thenReturn(List.of());

		assertThat(controller.ranking(10).data()).isEmpty();
	}
}
