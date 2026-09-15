package com.ssafy.backend.realtime.nearby.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventBus;
import com.ssafy.backend.realtime.messaging.RealtimeDestination;
import com.ssafy.backend.realtime.messaging.RealtimeEventType;
import com.ssafy.backend.realtime.messaging.RealtimePublisher;
import com.ssafy.backend.realtime.meeting.MeetingService;
import com.ssafy.backend.realtime.nearby.dto.NearbyDelta;
import com.ssafy.backend.realtime.nearby.dto.NearbySnapshot;
import com.ssafy.backend.realtime.nearby.port.NeighborPort;
import com.ssafy.backend.realtime.nearby.port.RiderCountPort;
import com.ssafy.backend.realtime.nearby.repository.NearbyRedisRepository;
import com.ssafy.backend.realtime.presence.dto.UserView;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.user.UserDisplayResolver;

/** Redis·소켓 없이 주변사람 델타 분류만 검증한다. */
@ExtendWith(MockitoExtension.class)
class NearbyDeltaServiceTests {

	@Mock NearbyRedisRepository nearbyRepo;
	@Mock UserDisplayResolver userDisplayResolver;
	@Mock RealtimePublisher publisher;
	@Mock RealtimeEventBus eventBus;
	@Mock NeighborPort neighborPort;
	@Mock MeetingService meetingService;
	@Mock RiderCountPort riderCountPort;
	@Mock PresenceRedisRepository presenceRepo;
	@Mock NearbyPeopleService nearbyPeopleService;
	@InjectMocks NearbyDeltaService service;

	private static final String ACTOR = "actor@x.com";

	@Test
	@DisplayName("구곡·신곡 구독자를 LEAVE·ENTER·MOVE로 나눈다")
	void classifiesOldAndNewSubscribers() {
		when(nearbyRepo.subscribers(10L)).thenReturn(Set.of("leave@x.com", "move@x.com", ACTOR));
		when(nearbyRepo.subscribers(20L)).thenReturn(Set.of("enter@x.com", "move@x.com", ACTOR));
		when(userDisplayResolver.resolve(ACTOR)).thenReturn(new UserView("노래하는 사람", "image"));
		when(meetingService.countWith("enter@x.com", ACTOR)).thenReturn(2);
		when(meetingService.countWith("move@x.com", ACTOR)).thenReturn(3);
		when(riderCountPort.count(ACTOR)).thenReturn(4);

		service.onPositionChanged(change(10L, 20L));

		verify(publisher).publishToUser("leave@x.com", RealtimeDestination.QUEUE_PRESENCE,
				RealtimeEventType.NEARBY_LEAVE,
				new NearbyDelta(ACTOR, null, null, null, null, null));
		verify(publisher).publishToUser("enter@x.com", RealtimeDestination.QUEUE_PRESENCE,
				RealtimeEventType.NEARBY_ENTER,
				new NearbyDelta(ACTOR, "노래하는 사람", "image", 2, 4, 20L));
		verify(publisher).publishToUser("move@x.com", RealtimeDestination.QUEUE_PRESENCE,
				RealtimeEventType.NEARBY_MOVE,
				new NearbyDelta(ACTOR, "노래하는 사람", "image", 3, 4, 20L));
		verifyNoMoreInteractions(publisher);
		verifyNoInteractions(neighborPort);
	}

	@Test
	@DisplayName("나가서 새 곡이 없으면 구곡 구독자에게 LEAVE만 보낸다")
	void leaveWhenNewMusicIsNull() {
		when(nearbyRepo.subscribers(10L)).thenReturn(Set.of("receiver@x.com"));

		service.onPositionChanged(change(10L, null));

		verify(publisher).publishToUser("receiver@x.com", RealtimeDestination.QUEUE_PRESENCE,
				RealtimeEventType.NEARBY_LEAVE,
				new NearbyDelta(ACTOR, null, null, null, null, null));
		verifyNoMoreInteractions(publisher);
		verifyNoInteractions(userDisplayResolver, meetingService, riderCountPort);
	}

	@Test
	@DisplayName("처음 들어와 구곡이 없으면 신곡 구독자에게 ENTER만 보낸다")
	void enterWhenOldMusicIsNull() {
		when(nearbyRepo.subscribers(20L)).thenReturn(Set.of("receiver@x.com"));
		when(userDisplayResolver.resolve(ACTOR)).thenReturn(new UserView("들어온 사람", "image"));

		service.onPositionChanged(change(null, 20L));

		verify(publisher).publishToUser("receiver@x.com", RealtimeDestination.QUEUE_PRESENCE,
				RealtimeEventType.NEARBY_ENTER,
				new NearbyDelta(ACTOR, "들어온 사람", "image", 0, 0, 20L));
		verifyNoMoreInteractions(publisher);
	}

	@Test
	@DisplayName("시작할 때 위치 변경 이벤트를 구독한다")
	void subscribesToPositionChanges() {
		service.subscribeToChanges();

		verify(eventBus).subscribe(any());
	}

	@Test
	@DisplayName("패널을 닫으면 저장된 곡의 델타가 더 이상 오지 않는다")
	void closeStopsLaterDeltas() {
		String viewer = "viewer@x.com";
		Set<String> activeSubscribers = new HashSet<>(Set.of(viewer));
		when(nearbyRepo.subscribedMusicIds(viewer)).thenReturn(List.of(20L));
		doAnswer(invocation -> {
			activeSubscribers.remove(invocation.getArgument(0, String.class));
			return null;
		}).when(nearbyRepo).unsubscribe(eq(viewer), eq(List.of(20L)));
		when(nearbyRepo.subscribers(20L)).thenAnswer(invocation -> Set.copyOf(activeSubscribers));
		NearbyPeopleService closeService = new NearbyPeopleService(
				presenceRepo, neighborPort, nearbyRepo, userDisplayResolver, meetingService, riderCountPort);

		closeService.close(viewer);
		service.onPositionChanged(change(null, 20L));

		verify(nearbyRepo).deleteMeta(viewer);
		verifyNoInteractions(publisher);
	}

	@Test
	@DisplayName("내 곡이 바뀌고 패널이 열려 있으면 구독과 목록을 다시 만든다")
	void ownAnchorChangeReopensAndPublishesSnapshot() {
		NearbySnapshot snapshot = new NearbySnapshot(20L, List.of());
		when(nearbyRepo.subscribers(10L)).thenReturn(Set.of(ACTOR));
		when(nearbyRepo.subscribers(20L)).thenReturn(Set.of(ACTOR));
		when(nearbyRepo.hasMeta(ACTOR)).thenReturn(true);
		when(nearbyPeopleService.open(ACTOR)).thenReturn(snapshot);

		service.onPositionChanged(change(10L, 20L));

		InOrder order = inOrder(nearbyRepo, nearbyPeopleService, publisher);
		order.verify(nearbyRepo).subscribers(10L);
		order.verify(nearbyRepo).subscribers(20L);
		order.verify(nearbyRepo).hasMeta(ACTOR);
		order.verify(nearbyPeopleService).open(ACTOR);
		order.verify(publisher).publishToUser(ACTOR, RealtimeDestination.QUEUE_PRESENCE,
				RealtimeEventType.NEARBY_SNAPSHOT, snapshot);
		verifyNoMoreInteractions(publisher);
		verifyNoInteractions(userDisplayResolver, meetingService, riderCountPort);
	}

	private PositionChanged change(Long oldMusicId, Long newMusicId) {
		return new PositionChanged(ACTOR, 1L, 1, oldMusicId, newMusicId,
				oldMusicId == null ? null : "1:1", newMusicId == null ? null : "2:2", 0.2, 0.3);
	}
}
