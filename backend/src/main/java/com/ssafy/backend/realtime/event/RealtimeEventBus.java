package com.ssafy.backend.realtime.event;

import java.util.function.Consumer;

/**
 * ★ 위치 변경 이벤트 버스 — 수평 확장 교체점(R-09). MVP 는 인프로세스, 다중화 시 Redis Pub/Sub.
 * 발행자(PlayDeclarationService)와 구독자(ViewportDeltaService·NearbyDeltaService)를 분리한다.
 */
public interface RealtimeEventBus {

	void publish(PositionChanged event);

	void subscribe(Consumer<PositionChanged> handler);
}
