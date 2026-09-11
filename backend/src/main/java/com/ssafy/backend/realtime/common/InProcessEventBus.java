package com.ssafy.backend.realtime.common;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

import org.springframework.stereotype.Component;

/**
 * 단일 인스턴스용 인프로세스 이벤트 버스. 구독자에게 동기 전달한다.
 * 다중 인스턴스 시 이 빈만 Redis Pub/Sub 브리지로 교체한다(R-09).
 *
 * 골격 단계: 등록·순회 골격만. 예외 격리·비동기 여부는 내부작업에서 결정.
 */
@Component
public class InProcessEventBus implements RealtimeEventBus {

	private final List<Consumer<PositionChanged>> handlers = new CopyOnWriteArrayList<>();

	@Override
	public void publish(PositionChanged event) {
		// TODO(내부작업): 구독자 순회 발행 + 예외 격리(한 구독자 실패가 다른 구독자를 막지 않게)
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	@Override
	public void subscribe(Consumer<PositionChanged> handler) {
		handlers.add(handler);
	}
}
