package com.ssafy.backend.realtime.service.viewport;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import com.ssafy.backend.realtime.config.RealtimeProperties;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.dto.viewport.ViewportDelta;
import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventServiceImpl;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.observability.ViewportMetrics;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ViewportMeta;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

/** 두 사용자의 이동과 화면 재연결 흐름을 한 번에 검증한다. */
class ViewportTwoSessionScenarioTests {

	private static final String ACTOR = "actor@example.com";
	private static final String VIEWER = "viewer@example.com";

	@Test
	@DisplayName("ENTER부터 화면 닫기와 재연결 뒤 새 ENTER까지 이어진다")
	@SuppressWarnings("unchecked")
	void enterMoveLeaveCloseAndReconnect() {
		ViewportRedisRepository viewportRepository = mock(ViewportRedisRepository.class);
		MusicLocationService musicLocationService = mock(MusicLocationService.class);
		UserDisplayService userDisplayService = mock(UserDisplayService.class);
		RiderCountService riderCountService = mock(RiderCountService.class);
		RealtimeMessageService messageService = mock(RealtimeMessageService.class);
		RealtimeEventServiceImpl eventService = new RealtimeEventServiceImpl();
		ViewportMetrics viewportMetrics = mock(ViewportMetrics.class);
		ViewportDeltaService deltaService = new ViewportDeltaService(
				viewportRepository, musicLocationService,
				new MusicPositionCalculator(properties()),
				userDisplayService, riderCountService, messageService, eventService,
				viewportMetrics);
		deltaService.subscribeToChanges();

		// 같은 셀 진입은 첫 연결, 화면 닫힘, 재연결 순서다.
		when(viewportRepository.findUsersWatchingCells(null, null, 0, "1:1"))
				.thenReturn(Set.of(VIEWER), Set.of(), Set.of(VIEWER));
		when(viewportRepository.findUsersWatchingCells(0, "1:1", 0, "2:2"))
				.thenReturn(Set.of(VIEWER));
		when(viewportRepository.findUsersWatchingCells(0, "2:2", null, null))
				.thenReturn(Set.of(VIEWER));
		when(viewportRepository.findMetaByEmails(Set.of(VIEWER)))
				.thenReturn(
						Map.of(VIEWER, meta(7, 10)),
						Map.of(VIEWER, meta(7, 10)),
						Map.of(VIEWER, meta(7, 10)),
						Map.of(VIEWER, meta(8, 1)));
		when(musicLocationService.findLocations(List.of(10L)))
				.thenReturn(Map.of(10L, pc(1, 1)));
		when(musicLocationService.findLocations(List.of(10L, 20L)))
				.thenReturn(Map.of(10L, pc(1, 1), 20L, pc(2, 2)));
		when(musicLocationService.findLocations(List.of(20L)))
				.thenReturn(Map.of(20L, pc(2, 2)));
		when(userDisplayService.find(ACTOR)).thenReturn(new UserDisplay("actor", "actor.png"));
		when(riderCountService.count(ACTOR)).thenReturn(2);

		eventService.send(change(null, 10L, null, "1:1"));
		eventService.send(change(10L, 20L, "1:1", "2:2"));
		eventService.send(change(20L, null, "2:2", null));
		eventService.send(change(null, 10L, null, "1:1"));
		eventService.send(change(null, 10L, null, "1:1"));

		InOrder order = inOrder(messageService);
		order.verify(messageService).sendToUser(
				VIEWER, WebSocketDestination.QUEUE_PRESENCE, RealtimeMessageType.VIEWPORT_ENTER,
				new ViewportDelta(10, ACTOR, "actor", "actor.png", 10L,
						1.0, 1.0, 2));
		order.verify(messageService).sendToUser(
				VIEWER, WebSocketDestination.QUEUE_PRESENCE, RealtimeMessageType.VIEWPORT_MOVE,
				new ViewportDelta(10, ACTOR, "actor", "actor.png", 20L,
						2.0, 2.0, 2));
		order.verify(messageService).sendToUser(
				VIEWER, WebSocketDestination.QUEUE_PRESENCE, RealtimeMessageType.VIEWPORT_LEAVE,
				new ViewportDelta(10, ACTOR, null, null, null, null, null, null));
		order.verify(messageService).sendToUser(
				VIEWER, WebSocketDestination.QUEUE_PRESENCE, RealtimeMessageType.VIEWPORT_ENTER,
				new ViewportDelta(1, ACTOR, "actor", "actor.png", 10L,
						1.0, 1.0, 2));
		order.verifyNoMoreInteractions();
	}

	/** 테스트 위치 변경을 만든다. */
	private static PositionChanged change(Long oldMusicId, Long newMusicId, String oldCell, String newCell) {
		return new PositionChanged(
				ACTOR, 7L,
				oldMusicId == null ? null : 0,
				newMusicId == null ? null : 0,
				oldMusicId, newMusicId, oldCell, newCell, 0.0, 0.0);
	}

	/** 테스트 화면 정보를 만든다. */
	private static ViewportMeta meta(long epoch, long requestSeq) {
		return new ViewportMeta(
				epoch, requestSeq, ViewportMode.INDIVIDUAL,
				new ViewportRange(0, 0, 4, 0, 4, List.of()), Set.of());
	}

	/** 두 축만 채운 곡 좌표를 만든다. */
	private static double[] pc(double x, double y) {
		double[] result = new double[16];
		result[0] = x;
		result[1] = y;
		return result;
	}

	/** 테스트 실시간 설정을 만든다. */
	private static RealtimeProperties properties() {
		List<RealtimeProperties.AxisRange> ranges = IntStream.rangeClosed(1, 16)
				.mapToObj(axis -> new RealtimeProperties.AxisRange(axis, 0, 16))
				.toList();
		return new RealtimeProperties(
				new RealtimeProperties.Presence(15_000, 45_000, 10_000, 60_000),
				new RealtimeProperties.Nearby(10),
				new RealtimeProperties.ViewportSettings(16, 36, 20, 64, 250, 5_000),
				ranges);
	}
}
