package com.ssafy.backend.realtime.event;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/** 한 서버 안에서 위치 변경을 등록된 순서대로 전달한다. */
@Slf4j
@Component
public class RealtimeEventServiceImpl implements RealtimeEventService {

	private final List<Consumer<PositionChanged>> handlers = new CopyOnWriteArrayList<>();

	@Override
	public void send(PositionChanged event) {
		for (Consumer<PositionChanged> handler : handlers) {
			try {
				handler.accept(event);
			} catch (RuntimeException e) {
				// 한 작업이 실패해도 나머지 작업은 계속한다.
				// 사용자 식별자는 로그에 남기지 않는다.
				log.warn("위치 변경 전달 실패 — 건너뜀", e);
			}
		}
	}

	@Override
	public void listen(Consumer<PositionChanged> handler) {
		handlers.add(handler);
	}
}
