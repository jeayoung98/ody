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
import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;

/** 주변사람 목록이 로그인 사용자 기준으로만 조회되는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class NearbyRestControllerTests {

	private static final String EMAIL = "user@x.com";

	@Mock NearbyPeopleService nearbyPeopleService;
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
}
