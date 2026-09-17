package com.ssafy.backend.realtime.event;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 한 서버 안에서 위치 변경이 순서대로 전달되는지 검증한다. */
class RealtimeEventServiceImplTests {

	private static final PositionChanged EVENT = new PositionChanged(
			"actor@x.com", 1L, 1, 1, 100L, 200L, "1:1", "2:2", 0.2, 0.3);

	@Test
	@DisplayName("등록한 구독자에게 순서대로 위치 변경 이벤트를 전달한다")
	void publishesToSubscribersInOrder() {
		RealtimeEventServiceImpl realtimeEventService = new RealtimeEventServiceImpl();
		List<String> calls = new ArrayList<>();
		realtimeEventService.listen(event -> calls.add("first:" + event.newMusicId()));
		realtimeEventService.listen(event -> calls.add("second:" + event.newMusicId()));

		realtimeEventService.send(EVENT);

		assertThat(calls).containsExactly("first:200", "second:200");
	}

	@Test
	@DisplayName("한 구독자가 실패해도 다음 구독자에게 계속 전달한다")
	void isolatesSubscriberFailure() {
		RealtimeEventServiceImpl realtimeEventService = new RealtimeEventServiceImpl();
		List<PositionChanged> received = new ArrayList<>();
		realtimeEventService.listen(event -> {
			throw new IllegalStateException("구독자 실패");
		});
		realtimeEventService.listen(received::add);

		realtimeEventService.send(EVENT);

		assertThat(received).containsExactly(EVENT);
	}
}
