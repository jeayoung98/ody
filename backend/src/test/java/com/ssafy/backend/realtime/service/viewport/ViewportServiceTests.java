package com.ssafy.backend.realtime.service.viewport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
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
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.config.RealtimeProperties;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.geometry.ViewportRange.LayerBound;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.service.user.UserDisplayService;
import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.dto.viewport.ViewportCellCount;
import com.ssafy.backend.realtime.observability.ViewportMetrics;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.CloseResult;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ReplaceResult;
import com.ssafy.backend.realtime.service.viewport.ViewportService.OpenResult;
import com.ssafy.backend.realtime.service.viewport.ViewportService.OpenStatus;

/** 현재 화면의 개별 사용자 목록을 만드는 순서와 결과를 검증한다. */
@ExtendWith(MockitoExtension.class)
class ViewportServiceTests {

	private static final String ME = "me@example.com";

	@Mock ViewportRedisRepository viewportRepository;
	@Mock PresenceRedisRepository presenceRepository;
	@Mock MusicLocationService musicLocationService;
	@Mock UserDisplayService userDisplayService;
	@Mock RiderCountService riderCountService;
	@Mock ViewportMetrics viewportMetrics; // 처리 시간·후보 수 기록

	private ViewportService service;

	@BeforeEach
	void setUp() {
		RealtimeProperties properties = properties();
		service = new ViewportService(
				new MusicPositionCalculator(properties), properties, viewportRepository,
				presenceRepository, musicLocationService, userDisplayService, riderCountService,
				viewportMetrics);
	}

	@Test
	@DisplayName("셀 구독을 먼저 바꾸고 실제 화면 안 사용자만 곡 위치별로 묶는다")
	void createsExactSnapshotAfterSubscription() {
		ViewportRange viewport = layerTwoViewport();
		when(viewportRepository.replaceSubscriptions(
				eq(ME), eq(7L), eq(11L), eq(viewport), eq(ViewportMode.INDIVIDUAL), anySet()))
				.thenReturn(ReplaceResult.APPLIED);
		when(presenceRepository.findActiveMusicIdsByCell(eq(1), anyList()))
				.thenReturn(Map.of(new Cell(4, 4), Set.of(101L, 102L, 103L, 104L)));
		when(musicLocationService.findLocations(List.of(101L, 102L, 103L, 104L))).thenReturn(Map.of(
				101L, pc(2, 2, 5, 6),
				102L, pc(8, 2, 5, 6),
				103L, pc(2, 2, 10, 6),
				104L, pc(3, 3, 7, 7)));
		when(presenceRepository.findListenersByMusic(1, List.of(101L, 104L))).thenReturn(Map.of(
				101L, Set.of(ME, "one@example.com", "same@example.com"),
				104L, Set.of("same@example.com", "two@example.com")));
		when(userDisplayService.find("one@example.com")).thenReturn(new UserDisplay("one", "one.png"));
		when(userDisplayService.find("same@example.com")).thenReturn(new UserDisplay("same", null));
		when(userDisplayService.find("two@example.com")).thenReturn(new UserDisplay("two", "two.png"));
		when(riderCountService.countAll(anyCollection())).thenReturn(Map.of("same@example.com", 2));

		OpenResult result = service.updateCurrentScreen(ME, 7L, 11L, viewport);

		assertThat(result.status()).isEqualTo(OpenStatus.SNAPSHOT);
		assertThat(result.snapshot().mode()).isEqualTo(ViewportMode.INDIVIDUAL);
		assertThat(result.snapshot().requestSeq()).isEqualTo(11L);
		assertThat(result.snapshot().resolution()).isNull();
		assertThat(result.snapshot().cells()).isEmpty();
		assertThat(result.snapshot().groups()).hasSize(2);
		assertThat(result.snapshot().groups().get(0).musicId()).isEqualTo(101L);
		// 표시 좌표는 정규화가 아니라 원시 PC 값이다 (레이어 1 = pc3·pc4)
		assertThat(result.snapshot().groups().get(0).x()).isEqualTo(5.0);
		assertThat(result.snapshot().groups().get(0).y()).isEqualTo(6.0);
		assertThat(result.snapshot().groups().get(0).users())
				.extracting(user -> user.email())
				.containsExactly("one@example.com", "same@example.com");
		assertThat(result.snapshot().groups().get(1).users())
				.extracting(user -> user.email())
				.containsExactly("two@example.com");
		assertThat(result.snapshot().groups().get(0).users().get(1).riderCount()).isEqualTo(2);

		InOrder order = inOrder(viewportRepository, presenceRepository);
		order.verify(viewportRepository)
				.replaceSubscriptions(
						eq(ME), eq(7L), eq(11L), eq(viewport), eq(ViewportMode.INDIVIDUAL), anySet());
		order.verify(presenceRepository).findActiveMusicIdsByCell(eq(1), anyList());
		verify(musicLocationService).findLocations(List.of(101L, 102L, 103L, 104L));
		verify(presenceRepository).findListenersByMusic(1, List.of(101L, 104L));
		verify(userDisplayService).find("same@example.com");
		// 사람마다 묻지 않고 화면에 보이는 사람을 한 번에 묶어 묻는다.
		verify(riderCountService).countAll(argThat(emails -> emails.containsAll(
				List.of("one@example.com", "same@example.com", "two@example.com"))));
		verify(viewportMetrics).recordSnapshot(
				eq("SNAPSHOT"), eq("INDIVIDUAL"),
				org.mockito.ArgumentMatchers.anyInt(), eq(4), eq(3), anyLong());
	}

	@Test
	@DisplayName("기본 셀이 36개를 넘으면 셀별 인원수 화면으로 바꾼다")
	void tooManyCellsRequiresClusteredMode() {
		ViewportRange wide = new ViewportRange(0, 0, 6, 0, 6, List.of());
		when(viewportRepository.replaceSubscriptions(
				eq(ME), eq(7L), eq(12L), eq(wide), eq(ViewportMode.CLUSTERED), eq(Set.of())))
				.thenReturn(ReplaceResult.APPLIED);
		when(viewportRepository.findUserCountsByCell(eq(0), anyList())).thenReturn(Map.of());

		OpenResult result = service.updateCurrentScreen(ME, 7L, 12L, wide);

		assertThat(result.status()).isEqualTo(OpenStatus.SNAPSHOT);
		assertThat(result.snapshot().mode()).isEqualTo(ViewportMode.CLUSTERED);
		verifyNoInteractions(musicLocationService, userDisplayService, riderCountService);
	}

	@Test
	@DisplayName("기본 셀이 정확히 36개면 개별 사용자 방식으로 처리한다")
	void thirtySixCellsUsesIndividualMode() {
		ViewportRange viewport = new ViewportRange(0, 0, 5, 0, 5, List.of());
		when(viewportRepository.replaceSubscriptions(
				eq(ME), eq(7L), eq(13L), eq(viewport), eq(ViewportMode.INDIVIDUAL), anySet()))
				.thenReturn(ReplaceResult.APPLIED);
		when(presenceRepository.findActiveMusicIdsByCell(eq(0), anyList())).thenReturn(Map.of());
		when(musicLocationService.findLocations(List.of())).thenReturn(Map.of());
		when(presenceRepository.findListenersByMusic(0, List.of())).thenReturn(Map.of());

		OpenResult result = service.updateCurrentScreen(ME, 7L, 13L, viewport);

		assertThat(result.status()).isEqualTo(OpenStatus.SNAPSHOT);
		assertThat(result.snapshot().mode()).isEqualTo(ViewportMode.INDIVIDUAL);
	}

	@Test
	@DisplayName("사용자가 20명을 넘으면 일부 개별 목록을 만들지 않는다")
	void tooManyUsersDoesNotReturnPartialSnapshot() {
		ViewportRange viewport = layerOneViewport();
		List<String> emails = IntStream.rangeClosed(1, 21)
				.mapToObj(i -> "user" + i + "@example.com")
				.toList();
		when(viewportRepository.replaceSubscriptions(
				eq(ME), eq(7L), eq(13L), eq(viewport), eq(ViewportMode.INDIVIDUAL), anySet()))
				.thenReturn(ReplaceResult.APPLIED);
		when(viewportRepository.replaceSubscriptions(
				eq(ME), eq(7L), eq(13L), eq(viewport), eq(ViewportMode.CLUSTERED), eq(Set.of())))
				.thenReturn(ReplaceResult.APPLIED);
		when(viewportRepository.findUserCountsByCell(eq(0), anyList())).thenReturn(Map.of());
		when(presenceRepository.findActiveMusicIdsByCell(eq(0), anyList()))
				.thenReturn(Map.of(new Cell(1, 1), Set.of(101L)));
		when(musicLocationService.findLocations(List.of(101L))).thenReturn(Map.of(101L, pc(1, 1, 0, 0)));
		when(presenceRepository.findListenersByMusic(0, List.of(101L)))
				.thenReturn(Map.of(101L, Set.copyOf(emails)));

		OpenResult result = service.updateCurrentScreen(ME, 7L, 13L, viewport);

		assertThat(result.status()).isEqualTo(OpenStatus.SNAPSHOT);
		assertThat(result.snapshot().mode()).isEqualTo(ViewportMode.CLUSTERED);
		verifyNoInteractions(userDisplayService, riderCountService);
	}

	@Test
	@DisplayName("사용자가 정확히 20명이면 개별 사용자 방식으로 처리한다")
	void twentyUsersUsesIndividualMode() {
		ViewportRange viewport = layerOneViewport();
		List<String> emails = IntStream.rangeClosed(1, 20)
				.mapToObj(i -> "user" + i + "@example.com")
				.toList();
		when(viewportRepository.replaceSubscriptions(
				eq(ME), eq(7L), eq(14L), eq(viewport), eq(ViewportMode.INDIVIDUAL), anySet()))
				.thenReturn(ReplaceResult.APPLIED);
		when(presenceRepository.findActiveMusicIdsByCell(eq(0), anyList()))
				.thenReturn(Map.of(new Cell(1, 1), Set.of(101L)));
		when(musicLocationService.findLocations(List.of(101L))).thenReturn(Map.of(101L, pc(1, 1, 0, 0)));
		when(presenceRepository.findListenersByMusic(0, List.of(101L)))
				.thenReturn(Map.of(101L, Set.copyOf(emails)));
		when(userDisplayService.find(anyString()))
				.thenAnswer(invocation -> new UserDisplay(invocation.getArgument(0), null));
		when(riderCountService.countAll(anyCollection())).thenReturn(Map.of());

		OpenResult result = service.updateCurrentScreen(ME, 7L, 14L, viewport);

		assertThat(result.status()).isEqualTo(OpenStatus.SNAPSHOT);
		assertThat(result.snapshot().mode()).isEqualTo(ViewportMode.INDIVIDUAL);
		assertThat(result.snapshot().groups())
				.flatExtracting(group -> group.users())
				.hasSize(20);
	}

	@Test
	@DisplayName("첫 레이어는 저장된 셀 인원수를 사용하고 요청자 본인을 뺀다")
	void createsLayerOneClusteredSnapshotFromStoredCounts() {
		ViewportRange viewport = layerOneViewport();
		List<Cell> cells = List.of(new Cell(1, 1), new Cell(2, 2));
		when(viewportRepository.findUserCountsByCell(0, cells)).thenReturn(Map.of(
				new Cell(1, 1), 3,
				new Cell(2, 2), 1));
		when(presenceRepository.snapshot(ME))
				.thenReturn(new PresenceSnapshot(101L, 0, 1, 1, 7L));

		var snapshot = service.createCellCountSnapshot(ME, 15L, viewport, cells);

		assertThat(snapshot.mode()).isEqualTo(ViewportMode.CLUSTERED);
		assertThat(snapshot.resolution()).isEqualTo(16);
		assertThat(snapshot.groups()).isEmpty();
		assertThat(snapshot.cells()).containsExactly(
				new ViewportCellCount(1, 1, 1.5, 1.5, 2),
				new ViewportCellCount(2, 2, 2.0, 2.0, 1));
		verifyNoInteractions(musicLocationService);
	}

	@Test
	@DisplayName("깊은 레이어는 이전 화면 범위를 통과한 곡의 청취자만 센다")
	void createsExactClusteredSnapshotForDeepLayer() {
		ViewportRange viewport = layerTwoViewport();
		List<Cell> cells = List.of(new Cell(4, 4));
		when(presenceRepository.findActiveMusicIdsByCell(1, cells))
				.thenReturn(Map.of(new Cell(4, 4), Set.of(101L, 102L, 103L)));
		when(musicLocationService.findLocations(List.of(101L, 102L, 103L))).thenReturn(Map.of(
				101L, pc(2, 2, 5, 6),
				102L, pc(8, 2, 5, 6),
				103L, pc(2, 2, 10, 6)));
		when(presenceRepository.findListenerCountsByMusic(1, List.of(101L)))
				.thenReturn(Map.of(101L, 4));
		when(presenceRepository.snapshot(ME))
				.thenReturn(new PresenceSnapshot(101L, 1, 5, 6, 7L));

		var snapshot = service.createCellCountSnapshot(ME, 16L, viewport, cells);

		assertThat(snapshot.mode()).isEqualTo(ViewportMode.CLUSTERED);
		assertThat(snapshot.cells()).containsExactly(
				new ViewportCellCount(5, 6, 5.5, 6.5, 3));
		verify(presenceRepository).findListenerCountsByMusic(1, List.of(101L));
	}

	@Test
	@DisplayName("더 새 화면 요청이 저장돼 있으면 사용자 조회를 멈춘다")
	void oldRequestStopsSnapshotRead() {
		ViewportRange viewport = layerOneViewport();
		when(viewportRepository.replaceSubscriptions(
				eq(ME), eq(7L), eq(3L), eq(viewport), eq(ViewportMode.INDIVIDUAL), anySet()))
				.thenReturn(ReplaceResult.OLD_REQUEST);

		OpenResult result = service.updateCurrentScreen(ME, 7L, 3L, viewport);

		assertThat(result.status()).isEqualTo(OpenStatus.OLD_REQUEST);
		verifyNoInteractions(presenceRepository, musicLocationService, userDisplayService, riderCountService);
	}

	@Test
	@DisplayName("이전 소켓의 요청이면 사용자 조회를 멈춘다")
	void staleConnectionStopsSnapshotRead() {
		ViewportRange viewport = layerOneViewport();
		when(viewportRepository.replaceSubscriptions(
				eq(ME), eq(6L), eq(1L), eq(viewport), eq(ViewportMode.INDIVIDUAL), anySet()))
				.thenReturn(ReplaceResult.STALE_CONNECTION);

		OpenResult result = service.updateCurrentScreen(ME, 6L, 1L, viewport);

		assertThat(result.status()).isEqualTo(OpenStatus.STALE_CONNECTION);
		verifyNoInteractions(presenceRepository, musicLocationService, userDisplayService, riderCountService);
		verify(viewportMetrics).recordSnapshot(
				eq("STALE_CONNECTION"), eq("NONE"),
				org.mockito.ArgumentMatchers.anyInt(), eq(0), eq(0), anyLong());
	}

	@Test
	@DisplayName("잘못된 이전 화면 범위는 구독을 바꾸기 전에 막는다")
	void invalidViewportStopsBeforeSubscription() {
		ViewportRange invalid = new ViewportRange(1, 4, 8, 4, 8, List.of());

		assertThatThrownBy(() -> service.updateCurrentScreen(ME, 7L, 14L, invalid))
				.isInstanceOf(IllegalArgumentException.class);
		verify(viewportRepository, never())
				.replaceSubscriptions(
						eq(ME), eq(7L), eq(14L), eq(invalid), eq(ViewportMode.INDIVIDUAL), anySet());
		verifyNoInteractions(presenceRepository, musicLocationService, userDisplayService, riderCountService);
	}

	@Test
	@DisplayName("화면 닫기를 Redis 저장소에 전달한다")
	void closesCurrentScreen() {
		when(viewportRepository.closeCurrentScreen(ME, 7L, 18L)).thenReturn(CloseResult.CLOSED);

		service.closeCurrentScreen(ME, 7L, 18L);

		verify(viewportRepository).closeCurrentScreen(ME, 7L, 18L);
		verify(viewportMetrics).recordClose("CLOSED");
		verifyNoInteractions(presenceRepository, musicLocationService, userDisplayService, riderCountService);
	}

	/** 테스트에서 사용할 실시간 설정을 만든다. */
	private static RealtimeProperties properties() {
		List<RealtimeProperties.AxisRange> ranges = IntStream.rangeClosed(1, 16)
				.mapToObj(axis -> new RealtimeProperties.AxisRange(axis, 0, 16))
				.toList();
		return new RealtimeProperties(
				new RealtimeProperties.Presence(15_000, 45_000, 10_000, 60_000),
				new RealtimeProperties.Nearby(10, 12),
				new RealtimeProperties.ViewportSettings(16, 36, 20, 64, 250, 5_000),
				ranges);
	}

	/** 이전 화면 조건이 없는 첫 레이어(0) 화면. */
	private static ViewportRange layerOneViewport() {
		return new ViewportRange(0, 0, 2, 0, 2, List.of());
	}

	/** 첫 레이어(0)의 선택 범위를 이어받은 두 번째 레이어(1) 화면 — 표시축은 pc3·pc4. */
	private static ViewportRange layerTwoViewport() {
		return new ViewportRange(1, 4, 8, 4, 8, List.of(new LayerBound(0, 0, 4, 0, 4)));
	}

	/** 앞 네 축만 채운 16차원 곡 좌표. */
	private static double[] pc(double pc1, double pc2, double pc3, double pc4) {
		double[] result = new double[16];
		result[0] = pc1;
		result[1] = pc2;
		result[2] = pc3;
		result[3] = pc4;
		return result;
	}
}
