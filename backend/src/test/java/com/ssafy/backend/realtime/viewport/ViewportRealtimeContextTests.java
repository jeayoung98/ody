package com.ssafy.backend.realtime.viewport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.ssafy.backend.realtime.geometry.CoordinateMapper;
import com.ssafy.backend.realtime.messaging.RealtimePublisher;
import com.ssafy.backend.realtime.port.MusicLocationPort;
import com.ssafy.backend.realtime.presence.controller.PresenceStompController;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.viewport.repository.ViewportRedisRepository;
import com.ssafy.backend.realtime.viewport.service.ViewportService;

/** test·realtime 프로파일에서 뷰포트 빈 연결을 확인한다. */
@SpringBootTest(properties = "spring.profiles.active=test,realtime")
class ViewportRealtimeContextTests {

	@Autowired ApplicationContext context;

	// 부팅 중 스케줄러가 실제 Redis를 읽지 않게 막는다.
	@MockitoBean PresenceRedisRepository presenceRedisRepository;

	@Test
	@DisplayName("realtime 프로파일에서 뷰포트 빈이 모두 연결된다")
	void viewportBeansAreWired() {
		assertThat(context.getBean(PresenceStompController.class)).isNotNull();
		assertThat(context.getBean(ViewportService.class)).isNotNull();
		assertThat(context.getBean(ViewportRedisRepository.class)).isNotNull();
		assertThat(context.getBean(CoordinateMapper.class)).isNotNull();
		assertThat(context.getBean(MusicLocationPort.class)).isNotNull();
		assertThat(context.getBean(RealtimePublisher.class)).isNotNull();
	}
}
