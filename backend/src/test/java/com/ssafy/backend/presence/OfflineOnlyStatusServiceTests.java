package com.ssafy.backend.presence;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 실시간을 켜지 않은 구성에서는 접속 여부를 알 수 없다. 늘 접속 안 함으로 답한다. */
class OfflineOnlyStatusServiceTests {

	private final OnlineStatusService service = new OfflineOnlyStatusService();

	@Test
	@DisplayName("누구를 물어도 접속 안 함이다")
	void alwaysOffline() {
		assertThat(service.isOnline("a@example.com")).isFalse();
	}

	@Test
	@DisplayName("여러 명을 물어도 아무도 담기지 않는다")
	void manyAreAllOffline() {
		assertThat(service.onlineOf(List.of("a@example.com", "b@example.com"))).isEmpty();
	}
}
