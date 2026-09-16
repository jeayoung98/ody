package com.ssafy.backend.realtime.viewport.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
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
import com.ssafy.backend.realtime.geometry.CellGrid.Cell;
import com.ssafy.backend.realtime.geometry.CoordinateMapper;
import com.ssafy.backend.realtime.geometry.Viewport;
import com.ssafy.backend.realtime.geometry.Viewport.LayerBound;
import com.ssafy.backend.realtime.nearby.port.RiderCountPort;
import com.ssafy.backend.realtime.port.MusicLocationPort;
import com.ssafy.backend.realtime.presence.dto.UserView;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.user.UserDisplayResolver;
import com.ssafy.backend.realtime.viewport.dto.ViewportMode;
import com.ssafy.backend.realtime.viewport.repository.ViewportRedisRepository;
import com.ssafy.backend.realtime.viewport.repository.ViewportRedisRepository.ReplaceResult;
import com.ssafy.backend.realtime.viewport.service.ViewportService.OpenResult;
import com.ssafy.backend.realtime.viewport.service.ViewportService.OpenStatus;

/** 현재 화면의 개별 사용자 목록을 만드는 순서와 결과를 검증한다. */
@ExtendWith(MockitoExtension.class)
class ViewportServiceTests {

	private static final String ME = "me@example.com";

	@Mock ViewportRedisRepository viewportRepository;
	@Mock PresenceRedisRepository presenceRepository;
	@Mock MusicLocationPort musicLocationPort;
	@Mock UserDisplayResolver userDisplayResolver;
	@Mock RiderCountPort riderCountPort;

	private ViewportService service;

	@BeforeEach
	void setUp() {
		RealtimeProperties properties = properties();
		service = new ViewportService(
				new CoordinateMapper(properties), properties, viewportRepository,
				presenceRepository, musicLocationPort, userDisplayResolver, riderCountPort);
	}

	@Test
	@DisplayName("셀 구독을 먼저 바꾸고 실제 화면 안 사용자만 곡 위치별로 묶는다")
	void createsExactSnapshotAfterSubscription() {
		Viewport viewport = layerTwoViewport();
		when(viewportRepository.replaceSubscriptions(eq(ME), eq(7L), eq(11L), eq(viewport), anySet()))
				.thenReturn(ReplaceResult.APPLIED);
		when(presenceRepository.findActiveMusicIdsByCell(eq(2), anyList()))
				.thenReturn(Map.of(new Cell(4, 4), Set.of(101L, 102L, 103L, 104L)));
		when(musicLocationPort.findLocations(List.of(101L, 102L, 103L, 104L))).thenReturn(Map.of(
				101L, pc(2, 2, 5, 6),
				102L, pc(8, 2, 5, 6),
				103L, pc(2, 2, 10, 6),
				104L, pc(3, 3, 7, 7)));
		when(presenceRepository.findListenersByMusic(2, List.of(101L, 104L))).thenReturn(Map.of(
				101L, Set.of(ME, "one@example.com", "same@example.com"),
				104L, Set.of("same@example.com", "two@example.com")));
		when(userDisplayResolver.resolve("one@example.com")).thenReturn(new UserView("one", "one.png"));
		when(userDisplayResolver.resolve("same@example.com")).thenReturn(new UserView("same", null));
		when(userDisplayResolver.resolve("two@example.com")).thenReturn(new UserView("two", "two.png"));
		when(riderCountPort.count(anyString()))
				.thenAnswer(invocation -> invocation.getArgument(0).equals("same@example.com") ? 2 : 0);

		OpenResult result = service.open(ME, 7L, 11L, viewport);

		assertThat(result.status()).isEqualTo(OpenStatus.SNAPSHOT);
		assertThat(result.snapshot().mode()).isEqualTo(ViewportMode.INDIVIDUAL);
		assertThat(result.snapshot().requestSeq()).isEqualTo(11L);
		assertThat(result.snapshot().resolution()).isNull();
		assertThat(result.snapshot().cells()).isEmpty();
		assertThat(result.snapshot().groups()).hasSize(2);
		assertThat(result.snapshot().groups().get(0).musicId()).isEqualTo(101L);
		assertThat(result.snapshot().groups().get(0).x()).isEqualTo(5.0 / 16.0);
		assertThat(result.snapshot().groups().get(0).y()).isEqualTo(6.0 / 16.0);
		assertThat(result.snapshot().groups().get(0).users())
				.extracting(user -> user.email())
				.containsExactly("one@example.com", "same@example.com");
		assertThat(result.snapshot().groups().get(1).users())
				.extracting(user -> user.email())
				.containsExactly("two@example.com");
		assertThat(result.snapshot().groups().get(0).users().get(1).riderCount()).isEqualTo(2);

		InOrder order = inOrder(viewportRepository, presenceRepository);
		order.verify(viewportRepository)
				.replaceSubscriptions(eq(ME), eq(7L), eq(11L), eq(viewport), anySet());
		order.verify(presenceRepository).findActiveMusicIdsByCell(eq(2), anyList());
		verify(musicLocationPort).findLocations(List.of(101L, 102L, 103L, 104L));
		verify(presenceRepository).findListenersByMusic(2, List.of(101L, 104L));
		verify(userDisplayResolver).resolve("same@example.com");
		verify(riderCountPort).count("same@example.com");
	}

	@Test
	@DisplayName("기본 셀이 36개를 넘으면 구독하거나 사용자를 조회하지 않는다")
	void tooManyCellsRequiresClusteredMode() {
		Viewport wide = new Viewport(1, 0, 6, 0, 6, List.of());

		OpenResult result = service.open(ME, 7L, 12L, wide);

		assertThat(result.status()).isEqualTo(OpenStatus.CLUSTERED_REQUIRED);
		assertThat(result.snapshot()).isNull();
		verifyNoInteractions(viewportRepository, presenceRepository, musicLocationPort,
				userDisplayResolver, riderCountPort);
	}

	@Test
	@DisplayName("사용자가 20명을 넘으면 일부 개별 목록을 만들지 않는다")
	void tooManyUsersDoesNotReturnPartialSnapshot() {
		Viewport viewport = layerOneViewport();
		List<String> emails = IntStream.rangeClosed(1, 21)
				.mapToObj(i -> "user" + i + "@example.com")
				.toList();
		when(viewportRepository.replaceSubscriptions(eq(ME), eq(7L), eq(13L), eq(viewport), anySet()))
				.thenReturn(ReplaceResult.APPLIED);
		when(presenceRepository.findActiveMusicIdsByCell(eq(1), anyList()))
				.thenReturn(Map.of(new Cell(1, 1), Set.of(101L)));
		when(musicLocationPort.findLocations(List.of(101L))).thenReturn(Map.of(101L, pc(1, 1, 0, 0)));
		when(presenceRepository.findListenersByMusic(1, List.of(101L)))
				.thenReturn(Map.of(101L, Set.copyOf(emails)));

		OpenResult result = service.open(ME, 7L, 13L, viewport);

		assertThat(result.status()).isEqualTo(OpenStatus.CLUSTERED_REQUIRED);
		assertThat(result.snapshot()).isNull();
		verifyNoInteractions(userDisplayResolver, riderCountPort);
	}

	@Test
	@DisplayName("더 새 화면 요청이 저장돼 있으면 사용자 조회를 멈춘다")
	void oldRequestStopsSnapshotRead() {
		Viewport viewport = layerOneViewport();
		when(viewportRepository.replaceSubscriptions(eq(ME), eq(7L), eq(3L), eq(viewport), anySet()))
				.thenReturn(ReplaceResult.OLD_REQUEST);

		OpenResult result = service.open(ME, 7L, 3L, viewport);

		assertThat(result.status()).isEqualTo(OpenStatus.OLD_REQUEST);
		verifyNoInteractions(presenceRepository, musicLocationPort, userDisplayResolver, riderCountPort);
	}

	@Test
	@DisplayName("이전 소켓의 요청이면 사용자 조회를 멈춘다")
	void staleConnectionStopsSnapshotRead() {
		Viewport viewport = layerOneViewport();
		when(viewportRepository.replaceSubscriptions(eq(ME), eq(6L), eq(1L), eq(viewport), anySet()))
				.thenReturn(ReplaceResult.STALE_CONNECTION);

		OpenResult result = service.open(ME, 6L, 1L, viewport);

		assertThat(result.status()).isEqualTo(OpenStatus.STALE_CONNECTION);
		verifyNoInteractions(presenceRepository, musicLocationPort, userDisplayResolver, riderCountPort);
	}

	@Test
	@DisplayName("잘못된 이전 화면 범위는 구독을 바꾸기 전에 막는다")
	void invalidViewportStopsBeforeSubscription() {
		Viewport invalid = new Viewport(2, 4, 8, 4, 8, List.of());

		assertThatThrownBy(() -> service.open(ME, 7L, 14L, invalid))
				.isInstanceOf(IllegalArgumentException.class);
		verify(viewportRepository, never())
				.replaceSubscriptions(eq(ME), eq(7L), eq(14L), eq(invalid), anySet());
		verifyNoInteractions(presenceRepository, musicLocationPort, userDisplayResolver, riderCountPort);
	}

	/** 테스트에서 사용할 실시간 설정을 만든다. */
	private static RealtimeProperties properties() {
		List<RealtimeProperties.AxisRange> ranges = IntStream.rangeClosed(1, 16)
				.mapToObj(axis -> new RealtimeProperties.AxisRange(axis, 0, 16))
				.toList();
		return new RealtimeProperties(
				new RealtimeProperties.Presence(15_000, 45_000, 10_000, 60_000),
				new RealtimeProperties.Nearby(10),
				new RealtimeProperties.Viewport(16, 36, 64, 250, 5_000),
				ranges);
	}

	/** 이전 화면 조건이 없는 첫 레이어 화면. */
	private static Viewport layerOneViewport() {
		return new Viewport(1, 0, 2, 0, 2, List.of());
	}

	/** 첫 레이어의 선택 범위를 이어받은 두 번째 레이어 화면. */
	private static Viewport layerTwoViewport() {
		return new Viewport(2, 4, 8, 4, 8, List.of(new LayerBound(1, 0, 4, 0, 4)));
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
