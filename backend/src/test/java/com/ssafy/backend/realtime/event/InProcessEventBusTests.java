package com.ssafy.backend.realtime.event;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 인프로세스 이벤트 버스의 동기 전달과 구독자별 실패 격리를 검증한다. */
class InProcessEventBusTests {

	private static final PositionChanged EVENT = new PositionChanged(
			"actor@x.com", 1L, 1, 100L, 200L, "1:1", "2:2", 0.2, 0.3);

	@Test
	@DisplayName("등록한 구독자에게 순서대로 위치 변경 이벤트를 전달한다")
	void publishesToSubscribersInOrder() {
		InProcessEventBus eventBus = new InProcessEventBus();
		List<String> calls = new ArrayList<>();
		eventBus.subscribe(event -> calls.add("first:" + event.newMusicId()));
		eventBus.subscribe(event -> calls.add("second:" + event.newMusicId()));

		eventBus.publish(EVENT);

		assertThat(calls).containsExactly("first:200", "second:200");
	}

	@Test
	@DisplayName("한 구독자가 실패해도 다음 구독자에게 계속 전달한다")
	void isolatesSubscriberFailure() {
		InProcessEventBus eventBus = new InProcessEventBus();
		List<PositionChanged> received = new ArrayList<>();
		eventBus.subscribe(event -> {
			throw new IllegalStateException("구독자 실패");
		});
		eventBus.subscribe(received::add);

		eventBus.publish(EVENT);

		assertThat(received).containsExactly(EVENT);
	}
}
