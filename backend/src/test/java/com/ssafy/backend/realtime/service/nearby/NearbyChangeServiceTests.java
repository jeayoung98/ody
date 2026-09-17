package com.ssafy.backend.realtime.service.nearby;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
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
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.service.meeting.MeetingService;
import com.ssafy.backend.realtime.dto.nearby.NearbyChange;
import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.service.nearby.NearbyMusicService;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.repository.redis.NearbyRedisRepository;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.session.WebSocketSessionService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

/** Redis·소켓 없이 주변사람 변경 종류만 검증한다. */
@ExtendWith(MockitoExtension.class)
class NearbyChangeServiceTests {

	@Mock NearbyRedisRepository nearbyRepository;
	@Mock UserDisplayService userDisplayService;
	@Mock RealtimeMessageService realtimeMessageService;
	@Mock RealtimeEventService realtimeEventService;
	@Mock NearbyMusicService nearbyMusicService;
	@Mock MeetingService meetingService;
	@Mock RiderCountService riderCountService;
	@Mock PresenceRedisRepository presenceRepository;
	@Mock WebSocketSessionService webSocketSessionService;
	@Mock NearbyPeopleService nearbyPeopleService;
	@InjectMocks NearbyChangeService service;

	private static final String ACTOR = "actor@x.com";

	@Test
	@DisplayName("구곡·신곡 구독자를 LEAVE·ENTER·MOVE로 나눈다")
	void classifiesOldAndNewSubscribers() {
		when(nearbyRepository.subscribers(10L)).thenReturn(Set.of("leave@x.com", "move@x.com", ACTOR));
		when(nearbyRepository.subscribers(20L)).thenReturn(Set.of("enter@x.com", "move@x.com", ACTOR));
		when(userDisplayService.find(ACTOR)).thenReturn(new UserDisplay("노래하는 사람", "image"));
		when(meetingService.countWith("enter@x.com", ACTOR)).thenReturn(2);
		when(meetingService.countWith("move@x.com", ACTOR)).thenReturn(3);
		when(riderCountService.count(ACTOR)).thenReturn(4);

		service.handlePositionChanged(change(10L, 20L));

		verify(realtimeMessageService).sendToUser("leave@x.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_LEAVE,
				new NearbyChange(ACTOR, null, null, null, null, null));
		verify(realtimeMessageService).sendToUser("enter@x.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_ENTER,
				new NearbyChange(ACTOR, "노래하는 사람", "image", 2, 4, 20L));
		verify(realtimeMessageService).sendToUser("move@x.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_MOVE,
				new NearbyChange(ACTOR, "노래하는 사람", "image", 3, 4, 20L));
		verifyNoMoreInteractions(realtimeMessageService);
		verifyNoInteractions(nearbyMusicService);
	}

	@Test
	@DisplayName("나가서 새 곡이 없으면 구곡 구독자에게 LEAVE만 보낸다")
	void leaveWhenNewMusicIsNull() {
		when(nearbyRepository.subscribers(10L)).thenReturn(Set.of("receiver@x.com"));

		service.handlePositionChanged(change(10L, null));

		verify(realtimeMessageService).sendToUser("receiver@x.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_LEAVE,
				new NearbyChange(ACTOR, null, null, null, null, null));
		verifyNoMoreInteractions(realtimeMessageService);
		verifyNoInteractions(userDisplayService, meetingService, riderCountService);
		verify(nearbyRepository, never()).hasSubscription(ACTOR);
		verifyNoInteractions(nearbyPeopleService);
	}

	@Test
	@DisplayName("처음 들어와 구곡이 없으면 신곡 구독자에게 ENTER만 보낸다")
	void enterWhenOldMusicIsNull() {
		when(nearbyRepository.subscribers(20L)).thenReturn(Set.of("receiver@x.com"));
		when(userDisplayService.find(ACTOR)).thenReturn(new UserDisplay("들어온 사람", "image"));

		service.handlePositionChanged(change(null, 20L));

		verify(realtimeMessageService).sendToUser("receiver@x.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_ENTER,
				new NearbyChange(ACTOR, "들어온 사람", "image", 0, 0, 20L));
		verifyNoMoreInteractions(realtimeMessageService);
	}

	@Test
	@DisplayName("시작할 때 위치 변경 이벤트를 구독한다")
	void subscribesToPositionChanges() {
		service.subscribeToChanges();

		verify(realtimeEventService).listen(any());
	}

	@Test
	@DisplayName("패널을 닫으면 저장된 곡의 변경 알림이 더 이상 오지 않는다")
	void closeStopsLaterChanges() {
		String viewer = "viewer@x.com";
		Set<String> activeSubscribers = new HashSet<>(Set.of(viewer));
		doAnswer(invocation -> {
			activeSubscribers.remove(viewer);
			return true;
		}).when(nearbyRepository).closeSubscriptions(viewer, 1L);
		when(nearbyRepository.subscribers(20L)).thenAnswer(invocation -> Set.copyOf(activeSubscribers));
		NearbyPeopleService closeService = new NearbyPeopleService(
				presenceRepository, nearbyMusicService, nearbyRepository, userDisplayService, meetingService, riderCountService, webSocketSessionService);

		closeService.close(viewer, 1L);
		service.handlePositionChanged(change(null, 20L));

		verify(nearbyRepository).closeSubscriptions(viewer, 1L);
		verifyNoInteractions(realtimeMessageService);
	}

	@Test
	@DisplayName("내 곡이 바뀌고 패널이 열려 있으면 구독과 목록을 다시 만든다")
	void ownAnchorChangeReopensAndPublishesSnapshot() {
		NearbySnapshot snapshot = new NearbySnapshot(20L, 5L, List.of());
		when(nearbyRepository.subscribers(10L)).thenReturn(Set.of(ACTOR));
		when(nearbyRepository.subscribers(20L)).thenReturn(Set.of(ACTOR));
		when(nearbyRepository.hasSubscription(ACTOR)).thenReturn(true);
		when(nearbyPeopleService.open(ACTOR)).thenReturn(snapshot);

		service.handlePositionChanged(change(10L, 20L));

		InOrder order = inOrder(nearbyRepository, nearbyPeopleService, realtimeMessageService);
		order.verify(nearbyRepository).subscribers(10L);
		order.verify(nearbyRepository).subscribers(20L);
		order.verify(nearbyRepository).hasSubscription(ACTOR);
		order.verify(nearbyPeopleService).open(ACTOR);
		order.verify(realtimeMessageService).sendToUser(ACTOR, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_SNAPSHOT, snapshot);
		verifyNoMoreInteractions(realtimeMessageService);
		verifyNoInteractions(userDisplayService, meetingService, riderCountService);
	}

	@Test
	@DisplayName("패널이 닫혀 있으면 내 곡이 바뀌어도 목록을 다시 만들지 않는다")
	void closedPanelDoesNotReissueSnapshot() {
		when(nearbyRepository.subscribers(10L)).thenReturn(Set.of(ACTOR));
		when(nearbyRepository.subscribers(20L)).thenReturn(Set.of(ACTOR));

		service.handlePositionChanged(change(10L, 20L));

		verify(nearbyRepository).hasSubscription(ACTOR);
		verifyNoInteractions(nearbyPeopleService, realtimeMessageService);
	}

	@Test
	@DisplayName("같은 곡이면 구독 조회와 변경 알림 발송을 하지 않는다")
	void sameMusicSkipsNearbyUpdate() {
		service.handlePositionChanged(change(10L, 10L));

		verifyNoInteractions(nearbyRepository, userDisplayService, realtimeMessageService,
				meetingService, riderCountService, nearbyPeopleService);
	}

	private PositionChanged change(Long oldMusicId, Long newMusicId) {
		return new PositionChanged(ACTOR, 1L,
				oldMusicId == null ? null : 1, newMusicId == null ? null : 1,
				oldMusicId, newMusicId,
				oldMusicId == null ? null : "1:1", newMusicId == null ? null : "2:2", 0.2, 0.3);
	}
}
