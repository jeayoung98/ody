package com.ssafy.backend.realtime.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.dto.viewport.ViewportMusicGroup;
import com.ssafy.backend.realtime.dto.viewport.ViewportSnapshot;
import com.ssafy.backend.realtime.dto.viewport.ViewportUser;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.service.viewport.ViewportService;
import com.ssafy.backend.realtime.service.viewport.ViewportService.OpenResult;
import com.ssafy.backend.realtime.service.viewport.ViewportService.OpenStatus;

/**
 * 화면 구독의 처음부터 끝까지를 실제 Redis 로 본다.
 *
 * 화면을 열면 그 안의 사람 목록을 받고, 그 뒤로는 누가 들어오고 나갈 때마다 조각 알림을 받는다.
 * 목록과 조각 알림은 서로 다른 코드가 만든다 — 둘이 어긋나면 화면에 있지도 않은 사람이 남거나,
 * 있어야 할 사람이 안 보인다. 조각 알림은 남의 재생·퇴장이 일으키므로 여기서만 같이 볼 수 있다.
 *
 * 구독 교체와 닫기 자체는 Lua 통합 시험이 이미 본다. 여기서는 그 위의 흐름만 본다.
 */
@Import(JdbcTransactionOnlyConfig.class)
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
@SpringBootTest(properties = {
		"spring.profiles.active=test,realtime",
		"spring.data.redis.host=${REDIS_TEST_HOST:127.0.0.1}",
		"spring.data.redis.port=${REDIS_TEST_PORT:6380}",
		"realtime.presence.sweep-interval-ms=3600000",
		"realtime.presence.recount-interval-ms=3600000",
		"realtime.viewport.cell-counts-interval-ms=3600000",
})
class ViewportScenarioRedisIntegrationTests extends RealtimeScenarioSupport {

	/** 1번 곡과 2번 곡은 들어오고 3번 곡은 빠지는 크기다. 셀 수도 개별 표시 기준 안이다. */
	private static final ViewportRange SCREEN =
			new ViewportRange(LAYER, -1.0, 6.0, -1.0, 6.0, List.of());

	@Autowired ViewportService viewportService;

	// ── 목록 ───────────────────────────────────────────────

	@Test
	@DisplayName("화면을 열면 그 안에 서 있는 남이 목록에 나온다")
	void openingTheScreenListsOthersInside() {
		String other = stand(SONG_A);
		String me = watcher();

		ViewportSnapshot snapshot = open(me, 1L);

		assertThat(snapshot.mode()).isEqualTo(ViewportMode.INDIVIDUAL);
		assertThat(emailsIn(snapshot)).containsExactly(other);
	}

	@Test
	@DisplayName("화면 밖에 서 있는 사람은 목록에 없다")
	void openingTheScreenSkipsOthersOutside() {
		stand(SONG_C);
		String me = watcher();

		assertThat(emailsIn(open(me, 1L))).isEmpty();
	}

	@Test
	@DisplayName("나는 내 목록에 나오지 않는다")
	void myOwnScreenDoesNotListMyself() {
		String me = stand(SONG_A);

		assertThat(emailsIn(open(me, 1L))).isEmpty();
	}

	@Test
	@DisplayName("따라가는 사람은 목록에 없고 인솔자에 인원수로 붙는다")
	void ridersAreHiddenAndCountedOnTheCaptain() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);
		String me = watcher();

		ViewportSnapshot snapshot = open(me, 1L);

		assertThat(emailsIn(snapshot)).containsExactly(captain);
		assertThat(usersIn(snapshot).get(0).riderCount()).isEqualTo(1);
	}

	// ── 조각 알림 ──────────────────────────────────────────

	@Test
	@DisplayName("남이 화면 안에 나타나면 들어옴 알림이 온다")
	void appearingInsideSendsEnter() {
		String me = watcher();
		open(me, 1L);
		clearInvocations(realtimeMessageService);

		stand(SONG_A);

		verify(realtimeMessageService)
				.sendToUser(eq(me), anyString(), eq(RealtimeMessageType.VIEWPORT_ENTER), any());
	}

	@Test
	@DisplayName("남이 화면 안에서 다른 곡으로 옮기면 이동 알림이 온다")
	void movingInsideSendsMove() {
		String other = stand(SONG_A);
		String me = watcher();
		open(me, 1L);
		clearInvocations(realtimeMessageService);

		moveTo(other, SONG_B);

		verify(realtimeMessageService)
				.sendToUser(eq(me), anyString(), eq(RealtimeMessageType.VIEWPORT_MOVE), any());
	}

	@Test
	@DisplayName("남이 화면 밖 곡으로 옮기면 나감 알림이 온다")
	void movingOutsideSendsLeave() {
		String other = stand(SONG_A);
		String me = watcher();
		open(me, 1L);
		clearInvocations(realtimeMessageService);

		moveTo(other, SONG_C);

		verify(realtimeMessageService)
				.sendToUser(eq(me), anyString(), eq(RealtimeMessageType.VIEWPORT_LEAVE), any());
	}

	@Test
	@DisplayName("남이 접속을 끊어도 나감 알림이 온다")
	void disconnectingSendsLeave() {
		String other = stand(SONG_A);
		String me = watcher();
		open(me, 1L);
		clearInvocations(realtimeMessageService);

		presenceService.leave(other, 1L);

		verify(realtimeMessageService)
				.sendToUser(eq(me), anyString(), eq(RealtimeMessageType.VIEWPORT_LEAVE), any());
	}

	// ── 화면을 닫은 뒤 ─────────────────────────────────────

	@Test
	@DisplayName("화면을 닫으면 구독이 남지 않고 알림도 오지 않는다")
	void closingTheScreenStopsEverything() {
		String me = watcher();
		open(me, 1L);

		viewportService.closeCurrentScreen(me, 1L, 1L);
		clearInvocations(realtimeMessageService);
		stand(SONG_A);

		assertThat(redis.hasKey("viewport:meta:" + me)).isFalse();
		verify(realtimeMessageService, never()).sendToUser(eq(me), anyString(), any(), any());
	}

	/**
	 * 앞의 화면 요청이 뒤늦게 도착한 경우다.
	 *
	 * 그대로 적용하면 사용자가 이미 다른 곳을 보고 있는데 옛 화면의 구독으로 되돌아간다.
	 * 그 뒤로는 보고 있지도 않은 자리의 알림만 오게 된다.
	 */
	@Test
	@DisplayName("옛 요청 번호로 온 화면 갱신은 무시된다")
	void anOldScreenRequestIsIgnored() {
		String me = watcher();
		open(me, 2L);

		OpenResult late = viewportService.updateCurrentScreen(me, 1L, 1L, SCREEN);

		assertThat(late.status()).isEqualTo(OpenStatus.OLD_REQUEST);
		assertThat(late.snapshot()).isNull();
		assertThat(redis.opsForHash().get("viewport:meta:" + me, "requestSeq")).isEqualTo("2");
	}

	@Test
	@DisplayName("옛 접속 번호로 온 화면 갱신은 무시된다")
	void anOldConnectionCannotChangeTheScreen() {
		String me = watcher();
		open(me, 1L);
		// 새 탭이 열린다. 접속 번호가 올라간다.
		presenceService.connect(me, 2L);

		OpenResult late = viewportService.updateCurrentScreen(me, 1L, 5L, SCREEN);

		assertThat(late.status()).isEqualTo(OpenStatus.STALE_CONNECTION);
	}

	// ── 도우미 ─────────────────────────────────────────────

	/** 화면을 열고 목록을 받는다. 목록이 안 나오면 시험이 거기서 멈춘다. */
	private ViewportSnapshot open(String email, long requestSeq) {
		OpenResult result = viewportService.updateCurrentScreen(email, 1L, requestSeq, SCREEN);
		assertThat(result.status()).isEqualTo(OpenStatus.SNAPSHOT);
		return result.snapshot();
	}

	private static List<ViewportUser> usersIn(ViewportSnapshot snapshot) {
		return snapshot.groups().stream().map(ViewportMusicGroup::users)
				.flatMap(List::stream).toList();
	}

	private static List<String> emailsIn(ViewportSnapshot snapshot) {
		return usersIn(snapshot).stream().map(ViewportUser::email).toList();
	}
}
