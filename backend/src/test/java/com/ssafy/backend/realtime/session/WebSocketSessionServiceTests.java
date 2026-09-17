package com.ssafy.backend.realtime.session;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 연결 세대와 개인 큐 seq의 생성·공유·정리를 검증한다. */
class WebSocketSessionServiceTests {

	@Test
	@DisplayName("활성 연결의 seq는 1부터 단조 증가하고 마지막 연결 종료 후 초기화된다")
	void sequenceIncreasesAndResetsAfterLastSession() {
		WebSocketSessionService webSocketSessionService = new WebSocketSessionService();

		webSocketSessionService.register("session-1", "user@x.com");
		assertThat(webSocketSessionService.nextMessageSeq("user@x.com")).isEqualTo(1L);
		assertThat(webSocketSessionService.nextMessageSeq("user@x.com")).isEqualTo(2L);

		webSocketSessionService.unregister("session-1");
		assertThat(webSocketSessionService.nextMessageSeq("user@x.com")).isZero();

		webSocketSessionService.register("session-2", "user@x.com");
		assertThat(webSocketSessionService.nextMessageSeq("user@x.com")).isEqualTo(1L);
	}

	@Test
	@DisplayName("같은 사용자의 여러 연결은 seq를 공유하고 하나만 끊기면 유지한다")
	void multipleSessionsShareSequence() {
		WebSocketSessionService webSocketSessionService = new WebSocketSessionService();
		webSocketSessionService.register("session-1", "user@x.com");
		webSocketSessionService.register("session-2", "user@x.com");

		assertThat(webSocketSessionService.nextMessageSeq("user@x.com")).isEqualTo(1L);
		webSocketSessionService.unregister("session-1");
		assertThat(webSocketSessionService.nextMessageSeq("user@x.com")).isEqualTo(2L);
		webSocketSessionService.unregister("session-2");
		assertThat(webSocketSessionService.nextMessageSeq("user@x.com")).isZero();
	}

	@Test
	@DisplayName("활성 연결이 없는 사용자는 seq 상태를 만들지 않고 0을 반환한다")
	void disconnectedUserGetsZero() {
		WebSocketSessionService webSocketSessionService = new WebSocketSessionService();

		assertThat(webSocketSessionService.nextMessageSeq("offline@x.com")).isZero();
		webSocketSessionService.register("session-1", "offline@x.com");
		assertThat(webSocketSessionService.nextMessageSeq("offline@x.com")).isEqualTo(1L);
	}

	@Test
	@DisplayName("현재 메시지 순번을 조회해도 값은 올라가지 않는다")
	void currentSequenceDoesNotIncrease() {
		WebSocketSessionService webSocketSessionService = new WebSocketSessionService();
		webSocketSessionService.register("session-1", "user@x.com");
		webSocketSessionService.nextMessageSeq("user@x.com");

		assertThat(webSocketSessionService.currentMessageSeq("user@x.com")).isEqualTo(1L);
		assertThat(webSocketSessionService.currentMessageSeq("user@x.com")).isEqualTo(1L);
		assertThat(webSocketSessionService.nextMessageSeq("user@x.com")).isEqualTo(2L);
	}
}
