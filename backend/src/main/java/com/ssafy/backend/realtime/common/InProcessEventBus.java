package com.ssafy.backend.realtime.common;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * 단일 인스턴스용 인프로세스 이벤트 버스. 구독자에게 동기 전달한다.
 * 다중 인스턴스 시 이 빈만 Redis Pub/Sub 브리지로 교체한다(R-09).
 *
 * 구독자에게 등록 순서대로 동기 전달하되, 한 구독자의 실패는 나머지 구독자와 발행자를 막지 않는다.
 */
@Slf4j
@Component
public class InProcessEventBus implements RealtimeEventBus {

	private final List<Consumer<PositionChanged>> handlers = new CopyOnWriteArrayList<>();

	@Override
	public void publish(PositionChanged event) {
		for (Consumer<PositionChanged> handler : handlers) {
			try {
				handler.accept(event);
			} catch (RuntimeException e) {
				// 한 델타 구독자 실패 때문에 재생 선언과 다른 구독자의 갱신까지 막히면 안 된다.
				// 사용자 식별자는 로그에 남기지 않는다.
				log.warn("위치 변경 이벤트 구독자 처리 실패 — 스킵", e);
			}
		}
	}

	@Override
	public void subscribe(Consumer<PositionChanged> handler) {
		handlers.add(handler);
	}
}
