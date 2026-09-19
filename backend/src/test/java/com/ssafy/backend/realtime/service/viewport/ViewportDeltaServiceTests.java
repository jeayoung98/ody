package com.ssafy.backend.realtime.service.viewport;

import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.config.RealtimeProperties;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.dto.viewport.ViewportDelta;
import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.geometry.ViewportRange.LayerBound;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.observability.ViewportMetrics;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ViewportMeta;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

/** 화면별 ENTER·MOVE·LEAVE 분류와 발송을 검증한다. */
@ExtendWith(MockitoExtension.class)
class ViewportDeltaServiceTests {

	private static final String ACTOR = "actor@example.com";

	@Mock ViewportRedisRepository viewportRepository;
	@Mock MusicLocationService musicLocationService;
	@Mock UserDisplayService userDisplayService;
	@Mock RiderCountService riderCountService;
	@Mock RealtimeMessageService realtimeMessageService;
	@Mock RealtimeEventService realtimeEventService;
	@Mock ViewportMetrics viewportMetrics; // 처리 시간·수신자 수 기록

	private ViewportDeltaService service;

	@BeforeEach
	void setUp() {
		service = new ViewportDeltaService(
				viewportRepository, musicLocationService,
				new MusicPositionCalculator(properties()),
				userDisplayService, riderCountService,
				realtimeMessageService, realtimeEventService, viewportMetrics);
	}

	@Test
	@DisplayName("서비스가 시작되면 위치 변경 알림을 구독한다")
	void subscribesToPositionChanges() {
		service.subscribeToChanges();

		verify(realtimeEventService).listen(org.mockito.ArgumentMatchers.any());
	}

	@Test
	@DisplayName("각 화면에서 보이는 이전 위치와 새 위치로 알림 종류를 정한다")
	void classifiesEnterMoveAndLeave() {
		PositionChanged event = change(10L, 20L, "1:1", "5:5");
		Set<String> candidates = Set.of(
				ACTOR, "leave@example.com", "enter@example.com",
				"move@example.com", "clustered@example.com");
		when(viewportRepository.findUsersWatchingCells(0, "1:1", 0, "5:5"))
				.thenReturn(candidates);
		when(viewportRepository.findMetaByEmails(anySet())).thenReturn(Map.of(
				"leave@example.com", meta(11, ViewportMode.INDIVIDUAL, range(0, 2)),
				"enter@example.com", meta(12, ViewportMode.INDIVIDUAL, range(4, 6)),
				"move@example.com", meta(13, ViewportMode.INDIVIDUAL, range(0, 6)),
				"clustered@example.com", meta(14, ViewportMode.CLUSTERED, range(0, 6))));
		when(musicLocationService.findLocations(List.of(10L, 20L))).thenReturn(Map.of(
				10L, pc(1, 1, 0, 0),
				20L, pc(5, 5, 0, 0)));
		when(userDisplayService.find(ACTOR)).thenReturn(new UserDisplay("actor", "actor.png"));
		when(riderCountService.count(ACTOR)).thenReturn(3);

		service.handlePositionChanged(event);

		verify(realtimeMessageService).sendToUser(
				"leave@example.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.VIEWPORT_LEAVE,
				new ViewportDelta(11, ACTOR, null, null, null, null, null, null));
		verify(realtimeMessageService).sendToUser(
				"enter@example.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.VIEWPORT_ENTER,
				new ViewportDelta(12, ACTOR, "actor", "actor.png", 20L,
						5.0, 5.0, 3));
		verify(realtimeMessageService).sendToUser(
				"move@example.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.VIEWPORT_MOVE,
				new ViewportDelta(13, ACTOR, "actor", "actor.png", 20L,
						5.0, 5.0, 3));
		verify(realtimeMessageService, never()).sendToUser(
				org.mockito.ArgumentMatchers.eq("clustered@example.com"),
				org.mockito.ArgumentMatchers.anyString(),
				org.mockito.ArgumentMatchers.any(),
				org.mockito.ArgumentMatchers.any());
		verify(musicLocationService).findLocations(List.of(10L, 20L));
		verify(userDisplayService).find(ACTOR);
		verify(riderCountService).count(ACTOR);
		verify(viewportMetrics).recordDelta(eq(4), eq(3), eq(3), anyLong());
	}

	@Test
	@DisplayName("같은 셀 안에서 위치가 바뀌어도 MOVE를 보낸다")
	void sendsMoveInsideSameCell() {
		PositionChanged event = change(10L, 20L, "1:1", "1:1");
		when(viewportRepository.findUsersWatchingCells(0, "1:1", 0, "1:1"))
				.thenReturn(Set.of("viewer@example.com"));
		when(viewportRepository.findMetaByEmails(Set.of("viewer@example.com")))
				.thenReturn(Map.of("viewer@example.com", meta(21, ViewportMode.INDIVIDUAL, range(0, 2))));
		when(musicLocationService.findLocations(List.of(10L, 20L))).thenReturn(Map.of(
				10L, pc(1, 1, 0, 0),
				20L, pc(1.5, 1.5, 0, 0)));
		when(userDisplayService.find(ACTOR)).thenReturn(new UserDisplay("actor", null));

		service.handlePositionChanged(event);

		verify(realtimeMessageService).sendToUser(
				"viewer@example.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.VIEWPORT_MOVE,
				new ViewportDelta(21, ACTOR, "actor", null, 20L,
						1.5, 1.5, 0));
	}

	@Test
	@DisplayName("레이어를 옮기면 이전 레이어에는 LEAVE, 새 레이어에는 ENTER를 보낸다")
	void sendsLeaveAndEnterForLayerChange() {
		PositionChanged event = new PositionChanged(
				ACTOR, 7L, 0, 1, 10L, 10L, "1:1", "5:5", 0.3, 0.3);
		when(viewportRepository.findUsersWatchingCells(0, "1:1", 1, "5:5"))
				.thenReturn(Set.of("old@example.com", "new@example.com"));
		ViewportRange newViewport = new ViewportRange(
				1, 4, 6, 4, 6, List.of(new LayerBound(0, 0, 2, 0, 2)));
		when(viewportRepository.findMetaByEmails(Set.of("old@example.com", "new@example.com")))
				.thenReturn(Map.of(
						"old@example.com", meta(25, ViewportMode.INDIVIDUAL, range(0, 2)),
						"new@example.com", new ViewportMeta(
								7, 26, ViewportMode.INDIVIDUAL, newViewport, Set.of())));
		when(musicLocationService.findLocations(List.of(10L)))
				.thenReturn(Map.of(10L, pc(1, 1, 5, 5)));
		when(userDisplayService.find(ACTOR)).thenReturn(new UserDisplay("actor", null));

		service.handlePositionChanged(event);

		verify(realtimeMessageService).sendToUser(
				"old@example.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.VIEWPORT_LEAVE,
				new ViewportDelta(25, ACTOR, null, null, null, null, null, null));
		verify(realtimeMessageService).sendToUser(
				"new@example.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.VIEWPORT_ENTER,
				new ViewportDelta(26, ACTOR, "actor", null, 10L,
						5.0, 5.0, 0));
		verify(musicLocationService).findLocations(List.of(10L));
	}

	@Test
	@DisplayName("이전 곡 좌표가 없어도 저장된 셀을 보고 있으면 LEAVE를 보낸다")
	void sendsLeaveWhenOldLocationIsMissing() {
		PositionChanged event = new PositionChanged(
				ACTOR, 7L, 0, null, 10L, null, "1:1", null, null, null);
		when(viewportRepository.findUsersWatchingCells(0, "1:1", null, null))
				.thenReturn(Set.of("viewer@example.com"));
		when(viewportRepository.findMetaByEmails(Set.of("viewer@example.com")))
				.thenReturn(Map.of("viewer@example.com", new ViewportMeta(
						7, 31, ViewportMode.INDIVIDUAL, range(0, 2), Set.of(new Cell(1, 1)))));
		when(musicLocationService.findLocations(List.of(10L))).thenReturn(Map.of());

		service.handlePositionChanged(event);

		verify(realtimeMessageService).sendToUser(
				"viewer@example.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.VIEWPORT_LEAVE,
				new ViewportDelta(31, ACTOR, null, null, null, null, null, null));
		verifyNoInteractions(userDisplayService, riderCountService);
	}

	@Test
	@DisplayName("셀 인원수 화면만 있으면 곡 좌표를 읽지 않는다")
	void skipsClusteredReceiversBeforeLocationRead() {
		PositionChanged event = change(10L, 20L, "1:1", "5:5");
		when(viewportRepository.findUsersWatchingCells(0, "1:1", 0, "5:5"))
				.thenReturn(Set.of("viewer@example.com"));
		when(viewportRepository.findMetaByEmails(Set.of("viewer@example.com")))
				.thenReturn(Map.of("viewer@example.com", meta(41, ViewportMode.CLUSTERED, range(0, 6))));

		service.handlePositionChanged(event);

		verifyNoInteractions(musicLocationService, userDisplayService, riderCountService, realtimeMessageService);
		verify(viewportMetrics).recordDelta(eq(1), eq(0), eq(0), anyLong());
	}

	@Test
	@DisplayName("이전 레이어 선택 범위를 벗어난 곡은 보내지 않는다")
	void skipsMusicOutsideAncestorBounds() {
		PositionChanged event = new PositionChanged(
				ACTOR, 7L, null, 1, null, 20L, null, "5:5", 0.3, 0.3);
		ViewportRange viewport = new ViewportRange(
				1, 4, 6, 4, 6, List.of(new LayerBound(0, 0, 2, 0, 2)));
		when(viewportRepository.findUsersWatchingCells(null, null, 1, "5:5"))
				.thenReturn(Set.of("viewer@example.com"));
		when(viewportRepository.findMetaByEmails(Set.of("viewer@example.com")))
				.thenReturn(Map.of("viewer@example.com", new ViewportMeta(
						7, 51, ViewportMode.INDIVIDUAL, viewport, Set.of())));
		when(musicLocationService.findLocations(List.of(20L)))
				.thenReturn(Map.of(20L, pc(5, 5, 5, 5)));

		service.handlePositionChanged(event);

		verifyNoInteractions(userDisplayService, riderCountService, realtimeMessageService);
	}

	private static PositionChanged change(Long oldMusicId, Long newMusicId, String oldCell, String newCell) {
		return new PositionChanged(
				ACTOR, 7L,
				oldMusicId == null ? null : 0, newMusicId == null ? null : 0,
				oldMusicId, newMusicId, oldCell, newCell, 0.3, 0.3);
	}

	private static ViewportMeta meta(long requestSeq, ViewportMode mode, ViewportRange viewport) {
		return new ViewportMeta(7, requestSeq, mode, viewport, Set.of());
	}

	/** 첫 레이어(0, pc1·pc2) 화면. */
	private static ViewportRange range(double min, double max) {
		return new ViewportRange(0, min, max, min, max, List.of());
	}

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

	private static double[] pc(double pc1, double pc2, double pc3, double pc4) {
		double[] result = new double[16];
		result[0] = pc1;
		result[1] = pc2;
		result[2] = pc3;
		result[3] = pc4;
		return result;
	}
}
