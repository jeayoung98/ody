package com.ssafy.backend.realtime.service.nearby;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import com.ssafy.backend.realtime.dto.nearby.NearbyBulkEnter;
import com.ssafy.backend.realtime.dto.nearby.NearbyChange;
import com.ssafy.backend.realtime.dto.nearby.NearbyRiderCount;
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

	// ── 선단이 흩어져 여러 사람이 한꺼번에 나타남 ───────────

	/** 해체는 위치 변경 알림을 거치지 않아, 이걸 안 보내면 목록이 끝내 안 바뀐다. */
	@Test
	@DisplayName("한 덩어리로 나타나면 받는 사람마다 한 번만 보낸다")
	void bulkEnterSendsOneMessagePerReceiver() {
		when(nearbyRepository.subscribers(100L)).thenReturn(Set.of("watcher@x.com"));
		when(userDisplayService.find("a@x.com")).thenReturn(new UserDisplay("A", "a.png"));
		when(userDisplayService.find("b@x.com")).thenReturn(new UserDisplay("B", null));
		when(riderCountService.countAll(List.of("a@x.com", "b@x.com")))
				.thenReturn(Map.of("a@x.com", 2));
		when(meetingService.countWith("watcher@x.com", "a@x.com")).thenReturn(3);
		when(meetingService.countWith("watcher@x.com", "b@x.com")).thenReturn(0);

		service.sendEnteredTogether(List.of("a@x.com", "b@x.com"), 100L);

		ArgumentCaptor<NearbyBulkEnter> captor = ArgumentCaptor.forClass(NearbyBulkEnter.class);
		verify(realtimeMessageService).sendToUser(eq("watcher@x.com"), anyString(),
				eq(RealtimeMessageType.NEARBY_BULK_ENTER), captor.capture());
		assertThat(captor.getValue().musicId()).isEqualTo(100L);
		assertThat(captor.getValue().people()).extracting(NearbyChange::email)
				.containsExactly("a@x.com", "b@x.com");
		assertThat(captor.getValue().people().get(0).riderCount()).isEqualTo(2);
		assertThat(captor.getValue().people().get(0).meetingCount()).isEqualTo(3);
		assertThat(captor.getValue().people().get(1).riderCount()).isZero();
	}

	/** 자기가 나타난 것을 자기가 받을 이유가 없다. */
	@Test
	@DisplayName("나타난 본인은 받지 않는다")
	void bulkEnterSkipsTheArrivalsThemselves() {
		when(nearbyRepository.subscribers(100L)).thenReturn(Set.of("a@x.com"));

		service.sendEnteredTogether(List.of("a@x.com"), 100L);

		verifyNoInteractions(realtimeMessageService, userDisplayService, meetingService);
	}

	@Test
	@DisplayName("보는 사람이 없으면 아무것도 읽지 않는다")
	void bulkEnterWithoutSubscribersDoesNothing() {
		when(nearbyRepository.subscribers(100L)).thenReturn(Set.of());

		service.sendEnteredTogether(List.of("a@x.com"), 100L);

		verifyNoInteractions(realtimeMessageService, userDisplayService, riderCountService);
	}

	@Test
	@DisplayName("나타난 사람이 없으면 보는 사람도 찾지 않는다")
	void bulkEnterWithoutArrivalsDoesNothing() {
		service.sendEnteredTogether(List.of(), 100L);

		verifyNoInteractions(nearbyRepository, realtimeMessageService);
	}

	/** 곡도 자리도 그대로다. 목록에서 숫자만 바꾸면 된다. */
	@Test
	@DisplayName("인원수 변화를 그 곡을 보는 사람들에게 알린다")
	void riderCountReachesSubscribers() {
		when(nearbyRepository.subscribers(100L))
				.thenReturn(Set.of("watcher@x.com", "captain@x.com"));

		service.sendRiderCount("captain@x.com", 100L, 3);

		verify(realtimeMessageService).sendToUser(eq("watcher@x.com"), anyString(),
				eq(RealtimeMessageType.NEARBY_RIDER_COUNT),
				eq(new NearbyRiderCount("captain@x.com", 3, 100L)));
		verify(realtimeMessageService, never()).sendToUser(eq("captain@x.com"), anyString(),
				eq(RealtimeMessageType.NEARBY_RIDER_COUNT), any());
	}
}
