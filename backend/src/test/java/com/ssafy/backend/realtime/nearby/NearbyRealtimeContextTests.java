package com.ssafy.backend.realtime.nearby;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.ssafy.backend.realtime.event.RealtimeEventBus;
import com.ssafy.backend.realtime.messaging.RealtimePublisher;
import com.ssafy.backend.realtime.nearby.controller.NearbyController;
import com.ssafy.backend.realtime.nearby.controller.NearbyStompController;
import com.ssafy.backend.realtime.nearby.port.RiderCountPort;
import com.ssafy.backend.realtime.nearby.repository.NearbyRedisRepository;
import com.ssafy.backend.realtime.nearby.service.NearbyDeltaService;
import com.ssafy.backend.realtime.nearby.service.NearbyPeopleService;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;

/** test·realtime 프로파일에서 주변사람 빈 연결을 확인한다. */
@SpringBootTest(properties = "spring.profiles.active=test,realtime")
class NearbyRealtimeContextTests {

	@Autowired ApplicationContext context;

	// 부팅 중 스케줄러가 실제 Redis를 읽지 않게 막는다.
	@MockitoBean PresenceRedisRepository presenceRedisRepository;

	@Test
	@DisplayName("realtime 프로파일에서 주변사람 빈이 모두 연결된다")
	void nearbyBeansAreWired() {
		assertThat(context.getBean(NearbyController.class)).isNotNull();
		assertThat(context.getBean(NearbyStompController.class)).isNotNull();
		assertThat(context.getBean(NearbyPeopleService.class)).isNotNull();
		assertThat(context.getBean(NearbyDeltaService.class)).isNotNull();
		assertThat(context.getBean(NearbyRedisRepository.class)).isNotNull();
		assertThat(context.getBean(RiderCountPort.class)).isNotNull();
		assertThat(context.getBean(RealtimeEventBus.class)).isNotNull();
		assertThat(context.getBean(RealtimePublisher.class)).isNotNull();
	}
}
