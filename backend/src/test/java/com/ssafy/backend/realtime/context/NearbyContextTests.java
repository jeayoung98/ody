package com.ssafy.backend.realtime.context;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.controller.rest.NearbyRestController;
import com.ssafy.backend.realtime.controller.websocket.NearbyWebSocketController;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.repository.redis.NearbyRedisRepository;
import com.ssafy.backend.realtime.service.nearby.NearbyChangeService;
import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;

/** test·realtime 프로파일에서 주변사람 구성 요소 연결을 확인한다. */
@SpringBootTest(properties = "spring.profiles.active=test,realtime")
class NearbyContextTests {

	@Autowired ApplicationContext context;

	// 부팅 중 스케줄러가 실제 Redis를 읽지 않게 막는다.
	@MockitoBean PresenceRedisRepository presenceRedisRepository;

	@Test
	@DisplayName("realtime 프로파일에서 주변사람 구성 요소가 모두 연결된다")
	void nearbyBeansAreWired() {
		assertThat(context.getBean(NearbyRestController.class)).isNotNull();
		assertThat(context.getBean(NearbyWebSocketController.class)).isNotNull();
		assertThat(context.getBean(NearbyPeopleService.class)).isNotNull();
		assertThat(context.getBean(NearbyChangeService.class)).isNotNull();
		assertThat(context.getBean(NearbyRedisRepository.class)).isNotNull();
		assertThat(context.getBean(RiderCountService.class)).isNotNull();
		assertThat(context.getBean(RealtimeEventService.class)).isNotNull();
		assertThat(context.getBean(RealtimeMessageService.class)).isNotNull();
	}
}
