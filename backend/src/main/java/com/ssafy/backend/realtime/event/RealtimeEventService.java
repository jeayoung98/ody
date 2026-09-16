package com.ssafy.backend.realtime.event;

import java.util.function.Consumer;

/** 위치 변경을 필요한 서비스에 전달한다. */
public interface RealtimeEventService {

	/** 위치 변경을 등록된 서비스에 알린다. */
	void send(PositionChanged event);

	/** 위치 변경을 받을 작업을 등록한다. */
	void listen(Consumer<PositionChanged> handler);
}
