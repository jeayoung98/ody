package com.ssafy.backend.realtime.scheduler;

import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.dto.viewport.ViewportCellCount;
import com.ssafy.backend.realtime.dto.viewport.ViewportCellCounts;
import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.dto.viewport.ViewportSnapshot;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.observability.ViewportMetrics;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ViewportMeta;
import com.ssafy.backend.realtime.service.viewport.ViewportService;

/** 셀별 인원수 화면의 주기 갱신 대상을 검증한다. */
@ExtendWith(MockitoExtension.class)
class ViewportCellCountSchedulerTests {

	private static final String ACTIVE = "active@test.local";
	private static final String OLD_MODE = "old-mode@test.local";
	private static final String WRONG_LAYER = "wrong-layer@test.local";
	private static final String NO_META = "no-meta@test.local";

	@Mock MusicPositionCalculator musicPositionCalculator;
	@Mock ViewportRedisRepository viewportRepository;
	@Mock ViewportService viewportService;
	@Mock RealtimeMessageService realtimeMessageService;
	@Mock ViewportMetrics viewportMetrics;

	private ViewportCellCountScheduler scheduler;

	@BeforeEach
	void setUp() {
		scheduler = new ViewportCellCountScheduler(
				musicPositionCalculator, viewportRepository, viewportService,
				realtimeMessageService, viewportMetrics);
	}

	@Test
	@DisplayName("대상과 화면 정보를 묶음 조회하고 현재 셀별 인원수 화면만 갱신한다")
	void sendsOnlyCurrentCellCountScreens() {
		ViewportRange layerOne = new ViewportRange(1, 0, 2, 0, 2, List.of());
		ViewportRange layerTwo = new ViewportRange(
				2, 0, 2, 0, 2,
				List.of(new ViewportRange.LayerBound(1, 0, 2, 0, 2)));
		Set<String> users = Set.of(ACTIVE, OLD_MODE, WRONG_LAYER, NO_META);
		when(musicPositionCalculator.maxLayer()).thenReturn(2);
		when(viewportRepository.findCellCountUsersByLayer(2)).thenReturn(Map.of(1, users));
		when(viewportRepository.findMetaByEmails(anySet())).thenReturn(Map.of(
				ACTIVE, meta(ViewportMode.CLUSTERED, 8L, layerOne),
				OLD_MODE, meta(ViewportMode.INDIVIDUAL, 9L, layerOne),
				WRONG_LAYER, meta(ViewportMode.CLUSTERED, 10L, layerTwo)));
		when(viewportService.createCellCountSnapshot(ACTIVE, 8L, layerOne))
				.thenReturn(ViewportSnapshot.clustered(8L, 1, 16, List.of(
						new ViewportCellCount(1, 1, 1.5, 1.5, 3),
						new ViewportCellCount(2, 2, 2.5, 2.5, 0))));

		scheduler.sendLatestCellCounts();

		verify(viewportRepository).findCellCountUsersByLayer(2);
		verify(viewportRepository).findMetaByEmails(users);
		verify(viewportService).createCellCountSnapshot(ACTIVE, 8L, layerOne);
		verify(viewportService, never()).createCellCountSnapshot(OLD_MODE, 9L, layerOne);
		verify(viewportService, never()).createCellCountSnapshot(WRONG_LAYER, 10L, layerTwo);

		ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
		verify(realtimeMessageService).sendToUser(
				org.mockito.ArgumentMatchers.eq(ACTIVE),
				org.mockito.ArgumentMatchers.eq(WebSocketDestination.QUEUE_PRESENCE),
				org.mockito.ArgumentMatchers.eq(RealtimeMessageType.VIEWPORT_CELL_COUNTS),
				payload.capture());
		ViewportCellCounts counts = (ViewportCellCounts) payload.getValue();
		org.assertj.core.api.Assertions.assertThat(counts.requestSeq()).isEqualTo(8L);
		org.assertj.core.api.Assertions.assertThat(counts.cells())
				.containsExactly(new ViewportCellCount(1, 1, 1.5, 1.5, 3));
		verify(viewportMetrics).recordCellCounts(
				eq(4), eq(1), anyLong());
	}

	@Test
	@DisplayName("갱신 대상이 없으면 화면 정보를 읽거나 메시지를 보내지 않는다")
	void skipsWhenNoUsersAreWatchingCellCounts() {
		when(musicPositionCalculator.maxLayer()).thenReturn(2);
		when(viewportRepository.findCellCountUsersByLayer(2)).thenReturn(Map.of());

		scheduler.sendLatestCellCounts();

		verify(viewportRepository).findMetaByEmails(Set.of());
		verify(realtimeMessageService, never()).sendToUser(
				org.mockito.ArgumentMatchers.anyString(),
				org.mockito.ArgumentMatchers.anyString(),
				org.mockito.ArgumentMatchers.any(),
				org.mockito.ArgumentMatchers.any());
		verify(viewportMetrics).recordCellCounts(
				eq(0), eq(0), anyLong());
	}

	@Test
	@DisplayName("한 사용자 갱신이 실패해도 대상 수와 성공 수를 기록한다")
	void recordsFailedCellCountUpdate() {
		ViewportRange viewport = new ViewportRange(1, 0, 2, 0, 2, List.of());
		when(musicPositionCalculator.maxLayer()).thenReturn(1);
		when(viewportRepository.findCellCountUsersByLayer(1))
				.thenReturn(Map.of(1, Set.of(ACTIVE)));
		when(viewportRepository.findMetaByEmails(Set.of(ACTIVE)))
				.thenReturn(Map.of(ACTIVE, meta(ViewportMode.CLUSTERED, 8L, viewport)));
		when(viewportService.createCellCountSnapshot(ACTIVE, 8L, viewport))
				.thenThrow(new IllegalStateException("test"));

		scheduler.sendLatestCellCounts();

		verify(viewportMetrics).recordCellCounts(
				eq(1), eq(0), anyLong());
	}

	/** 테스트용 화면 정보를 만든다. */
	private static ViewportMeta meta(ViewportMode mode, long requestSeq, ViewportRange viewport) {
		return new ViewportMeta(7L, requestSeq, mode, viewport, Set.of());
	}
}
