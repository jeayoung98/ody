package com.ssafy.backend.realtime.context;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.controller.websocket.PresenceWebSocketController;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.service.viewport.ViewportService;

/** test·realtime 프로파일에서 뷰포트 구성 요소 연결을 확인한다. */
@SpringBootTest(properties = "spring.profiles.active=test,realtime")
class ViewportContextTests {

	@Autowired ApplicationContext context;

	// 부팅 중 스케줄러가 실제 Redis를 읽지 않게 막는다.
	@MockitoBean PresenceRedisRepository presenceRedisRepository;

	@Test
	@DisplayName("realtime 프로파일에서 뷰포트 구성 요소가 모두 연결된다")
	void viewportBeansAreWired() {
		assertThat(context.getBean(PresenceWebSocketController.class)).isNotNull();
		assertThat(context.getBean(ViewportService.class)).isNotNull();
		assertThat(context.getBean(ViewportRedisRepository.class)).isNotNull();
		assertThat(context.getBean(MusicPositionCalculator.class)).isNotNull();
		assertThat(context.getBean(MusicLocationService.class)).isNotNull();
		assertThat(context.getBean(RealtimeMessageService.class)).isNotNull();
	}
}
