package com.ssafy.backend.realtime.service.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.dto.viewport.ViewportCellCount;
import com.ssafy.backend.realtime.dto.viewport.ViewportCellCounts;
import com.ssafy.backend.realtime.dto.viewport.ViewportDelta;
import com.ssafy.backend.realtime.dto.viewport.ViewportMusicGroup;
import com.ssafy.backend.realtime.dto.viewport.ViewportSnapshot;
import com.ssafy.backend.realtime.dto.viewport.ViewportUser;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;

/** 인솔자 화면이 따라오는 사람들에게 그대로 가는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RideViewportServiceTests {

	private static final String CAPTAIN = "captain@x.com";
	private static final String RIDER_A = "a@x.com";
	private static final String RIDER_B = "b@x.com";

	@Mock RideRedisRepository rideRedisRepository;
	@Mock RealtimeMessageService realtimeMessageService;
	@InjectMocks RideViewportService service;

	private static ViewportSnapshot snapshot() {
		ViewportUser user = new ViewportUser("someone@x.com", "누군가", null, 0);
		return ViewportSnapshot.individual(
				12L, 3, List.of(new ViewportMusicGroup(10877L, 1.5, -2.5, List.of(user))));
	}

	private static ViewportDelta delta() {
		return new ViewportDelta(12L, "someone@x.com", "누군가", null, 10877L, 1.5, -2.5, 0);
	}

	private static ViewportCellCounts cellCounts() {
		return new ViewportCellCounts(12L, 3, 8, List.of(new ViewportCellCount(1, 2, 0.5, 0.5, 4)));
	}

	/** 사람마다 다시 만들면 같은 순간에 서로 다른 화면을 보게 된다. */
	@Test
	@DisplayName("인솔자가 받은 목록을 그대로 보낸다")
	void sendsSameSnapshotObject() {
		ViewportSnapshot snapshot = snapshot();
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of(RIDER_A));

		service.mirrorSnapshot(CAPTAIN, snapshot);

		verify(realtimeMessageService).sendToUser(RIDER_A, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_VIEWPORT, snapshot);
	}

	@Test
	@DisplayName("따라오는 사람 모두에게 보낸다")
	void sendsToEveryRider() {
		ViewportSnapshot snapshot = snapshot();
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of(RIDER_A, RIDER_B));

		service.mirrorSnapshot(CAPTAIN, snapshot);

		verify(realtimeMessageService).sendToUser(RIDER_A, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_VIEWPORT, snapshot);
		verify(realtimeMessageService).sendToUser(RIDER_B, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_VIEWPORT, snapshot);
	}

	@Test
	@DisplayName("따라오는 사람이 없으면 보내지 않는다")
	void noRidersSendsNothing() {
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of());

		service.mirrorSnapshot(CAPTAIN, snapshot());

		verifyNoInteractions(realtimeMessageService);
	}

	/** 목록이 없는 결과까지 보내면 따라가는 쪽이 빈 화면으로 덮어쓴다. */
	@Test
	@DisplayName("보낼 목록이 없으면 명단도 읽지 않는다")
	void nullSnapshotDoesNothing() {
		service.mirrorSnapshot(CAPTAIN, null);

		verifyNoInteractions(rideRedisRepository, realtimeMessageService);
	}

	@Test
	@DisplayName("따라가는 사람 자신의 화면 요청 답과 다른 종류로 보낸다")
	void usesRideTypeNotViewportType() {
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of(RIDER_A));

		service.mirrorSnapshot(CAPTAIN, snapshot());

		verify(realtimeMessageService, never()).sendToUser(
				anyString(), anyString(), eq(RealtimeMessageType.VIEWPORT_SNAPSHOT), any());
	}

	/** 나간 사람 알림을 안 옮기면 그 마커가 따라가는 사람 화면에 계속 떠 있다. */
	@Test
	@DisplayName("들어옴·움직임·나감을 같은 뜻의 다른 종류로 옮긴다")
	void mapsEachDeltaType() {
		ViewportDelta delta = delta();

		service.mirrorDelta(Set.of(RIDER_A), RealtimeMessageType.VIEWPORT_ENTER, delta);
		service.mirrorDelta(Set.of(RIDER_A), RealtimeMessageType.VIEWPORT_MOVE, delta);
		service.mirrorDelta(Set.of(RIDER_A), RealtimeMessageType.VIEWPORT_LEAVE, delta);

		verify(realtimeMessageService).sendToUser(RIDER_A, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_VIEWPORT_ENTER, delta);
		verify(realtimeMessageService).sendToUser(RIDER_A, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_VIEWPORT_MOVE, delta);
		verify(realtimeMessageService).sendToUser(RIDER_A, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_VIEWPORT_LEAVE, delta);
	}

	@Test
	@DisplayName("옮길 수 없는 종류는 보내지 않는다")
	void unknownTypeIsNotSent() {
		service.mirrorDelta(Set.of(RIDER_A), RealtimeMessageType.PRESENCE_JOINED, delta());

		verifyNoInteractions(realtimeMessageService);
	}

	@Test
	@DisplayName("따라오는 사람이 없으면 알림도 보내지 않는다")
	void deltaWithoutRidersSendsNothing() {
		service.mirrorDelta(null, RealtimeMessageType.VIEWPORT_MOVE, delta());
		service.mirrorDelta(Set.of(), RealtimeMessageType.VIEWPORT_MOVE, delta());

		verifyNoInteractions(realtimeMessageService);
	}

	/** 넓은 화면에서는 이것마저 없으면 자리별 사람 수가 멈춰 있다. */
	@Test
	@DisplayName("자리별 사람 수도 그대로 옮긴다")
	void mirrorsCellCounts() {
		ViewportCellCounts counts = cellCounts();
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of(RIDER_A));

		service.mirrorCellCounts(CAPTAIN, counts);

		verify(realtimeMessageService).sendToUser(RIDER_A, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_VIEWPORT_CELL_COUNTS, counts);
	}

	/** 한 명씩 물으면 수신자 수만큼 왕복이 생겨 그대로 지연이 된다. */
	@Test
	@DisplayName("여러 사람의 따라오는 사람을 한 번에 묻는다")
	void asksAllRidersAtOnce() {
		when(rideRedisRepository.ridersOf(List.of(CAPTAIN)))
				.thenReturn(Map.of(CAPTAIN, Set.of(RIDER_A)));

		assertThat(service.ridersOf(List.of(CAPTAIN)))
				.containsEntry(CAPTAIN, Set.of(RIDER_A));
	}
}
