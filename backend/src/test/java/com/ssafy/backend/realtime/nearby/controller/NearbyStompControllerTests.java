package com.ssafy.backend.realtime.nearby.controller;

import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.nearby.service.NearbyPeopleService;

/** 주변사람 소켓 요청이 로그인 사용자 기준으로 전달되는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class NearbyStompControllerTests {

	@Mock NearbyPeopleService nearbyPeopleService;
	@InjectMocks NearbyStompController controller;

	@Test
	@DisplayName("close는 로그인 사용자의 주변사람 구독을 닫는다")
	void closeUsesPrincipalEmail() {
		controller.close(() -> "viewer@x.com");

		verify(nearbyPeopleService).close("viewer@x.com");
	}
}
