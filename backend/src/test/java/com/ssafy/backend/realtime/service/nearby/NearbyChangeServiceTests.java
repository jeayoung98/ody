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
import java.util.Optional;
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
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.repository.redis.NearbyRedisRepository;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
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
	@Mock MeetingService meetingService;
	@Mock RiderCountService riderCountService;
	@Mock PresenceRedisRepository presenceRepository;
	@Mock WebSocketSessionService webSocketSessionService;
	@Mock NearbyPeopleService nearbyPeopleService;
	@Mock MusicLocationService musicLocationService;
	@Mock MusicPositionCalculator musicPositionCalculator;
	@InjectMocks NearbyChangeService service;

	private static final String ACTOR = "actor@x.com";

	/** 한 사람은 층 하나만 구독한다. 층이 다르면 두 집합이 겹치지 않아 LEAVE 와 ENTER 로 갈린다. */
	@Test
	@DisplayName("층을 옮기면 떠난 층에 LEAVE, 닿은 층에 ENTER 를 보낸다")
	void layerChangeSplitsLeaveAndEnter() {
		when(nearbyRepository.subscribers(1)).thenReturn(Set.of("leave@x.com", ACTOR));
		when(nearbyRepository.subscribers(2)).thenReturn(Set.of("enter@x.com", ACTOR));
		when(userDisplayService.find(ACTOR)).thenReturn(new UserDisplay("노래하는 사람", "image"));
		when(meetingService.countWith("enter@x.com", ACTOR)).thenReturn(2);
		when(riderCountService.count(ACTOR)).thenReturn(4);
		givenSpot(20L, 2, 3.0, 4.0);

		service.handlePositionChanged(moved(1, 10L, 2, 20L));

		verify(realtimeMessageService).sendToUser("leave@x.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_LEAVE,
				new NearbyChange(ACTOR, null, null, null, null, null, null, null));
		verify(realtimeMessageService).sendToUser("enter@x.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_ENTER,
				new NearbyChange(ACTOR, "노래하는 사람", "image", 2, 4, 20L, 3.0, 4.0));
		verifyNoMoreInteractions(realtimeMessageService);
	}

	/**
	 * 같은 층에서 곡만 바꾸면 목록에 담길 사람은 그대로다. 자리만 옮기므로 전원이 MOVE 다.
	 * 예전에는 구독자 집합 셋을 견줘야 알 수 있던 것이다.
	 */
	@Test
	@DisplayName("같은 층에서 곡만 바꾸면 그 층 사람 전원에게 MOVE 를 보낸다")
	void sameLayerSongChangeIsMove() {
		when(nearbyRepository.subscribers(1)).thenReturn(Set.of("watcher@x.com", ACTOR));
		when(userDisplayService.find(ACTOR)).thenReturn(new UserDisplay("노래하는 사람", "image"));
		when(meetingService.countWith("watcher@x.com", ACTOR)).thenReturn(3);
		when(riderCountService.count(ACTOR)).thenReturn(4);
		givenSpot(20L, 1, 5.0, 6.0);

		service.handlePositionChanged(moved(1, 10L, 1, 20L));

		verify(realtimeMessageService).sendToUser("watcher@x.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_MOVE,
				new NearbyChange(ACTOR, "노래하는 사람", "image", 3, 4, 20L, 5.0, 6.0));
		verifyNoMoreInteractions(realtimeMessageService);
	}

	/** 자리를 못 구해도 누가 들어왔는지는 알려야 한다. 좌표만 비운다. */
	@Test
	@DisplayName("곡 자리를 못 구하면 좌표 없이 알린다")
	void missingSpotStillNotifies() {
		when(nearbyRepository.subscribers(1)).thenReturn(Set.of("watcher@x.com"));
		when(userDisplayService.find(ACTOR)).thenReturn(new UserDisplay("노래하는 사람", "image"));
		when(musicPositionCalculator.findAxes(1)).thenReturn(new int[] {1, 2});
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.empty());

		service.handlePositionChanged(moved(1, 10L, 1, 20L));

		verify(realtimeMessageService).sendToUser(eq("watcher@x.com"), anyString(),
				eq(RealtimeMessageType.NEARBY_MOVE),
				eq(new NearbyChange(ACTOR, "노래하는 사람", "image", 0, 0, 20L, null, null)));
	}

	@Test
	@DisplayName("나가면 떠난 층 사람들에게 LEAVE 만 보낸다")
	void leaveWhenGone() {
		when(nearbyRepository.subscribers(1)).thenReturn(Set.of("receiver@x.com"));

		service.handlePositionChanged(moved(1, 10L, null, null));

		verify(realtimeMessageService).sendToUser("receiver@x.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_LEAVE,
				new NearbyChange(ACTOR, null, null, null, null, null, null, null));
		verifyNoMoreInteractions(realtimeMessageService);
		verifyNoInteractions(userDisplayService, meetingService, riderCountService);
	}

	@Test
	@DisplayName("처음 들어오면 닿은 층 사람들에게 ENTER 만 보낸다")
	void enterWhenFirstArriving() {
		when(nearbyRepository.subscribers(2)).thenReturn(Set.of("receiver@x.com"));
		when(userDisplayService.find(ACTOR)).thenReturn(new UserDisplay("들어온 사람", "image"));
		givenSpot(20L, 2, 1.0, 2.0);

		service.handlePositionChanged(moved(null, null, 2, 20L));

		verify(realtimeMessageService).sendToUser("receiver@x.com", WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_ENTER,
				new NearbyChange(ACTOR, "들어온 사람", "image", 0, 0, 20L, 1.0, 2.0));
		verifyNoMoreInteractions(realtimeMessageService);
	}

	@Test
	@DisplayName("시작할 때 위치 변경 이벤트를 구독한다")
	void subscribesToPositionChanges() {
		service.subscribeToChanges();

		verify(realtimeEventService).listen(any());
	}

	@Test
	@DisplayName("패널을 닫으면 그 층의 변경 알림이 더 이상 오지 않는다")
	void closeStopsLaterChanges() {
		String viewer = "viewer@x.com";
		Set<String> activeSubscribers = new HashSet<>(Set.of(viewer));
		doAnswer(invocation -> {
			activeSubscribers.remove(viewer);
			return true;
		}).when(nearbyRepository).closeSubscriptions(viewer, 1L);
		when(nearbyRepository.subscribers(2)).thenAnswer(invocation -> Set.copyOf(activeSubscribers));
		// 이 시험이 보는 것은 닫기 한 가지뿐이라, 닫기가 안 쓰는 이웃은 null 로 둔다.
		NearbyPeopleService closeService = new NearbyPeopleService(
				presenceRepository, null, null, null, nearbyRepository, meetingService, webSocketSessionService, null);

		closeService.close(viewer, 1L);
		service.handlePositionChanged(moved(null, null, 2, 20L));

		verify(nearbyRepository).closeSubscriptions(viewer, 1L);
		verifyNoInteractions(realtimeMessageService);
	}

	/** 층이 바뀌면 내 목록에 담길 사람이 통째로 달라진다. 구독도 목록도 다시 만들어야 한다. */
	@Test
	@DisplayName("내가 층을 옮기고 패널이 열려 있으면 구독과 목록을 다시 만든다")
	void ownLayerChangeReopensAndPublishesSnapshot() {
		NearbySnapshot snapshot = new NearbySnapshot(20L, 5L, List.of());
		when(nearbyRepository.subscribers(1)).thenReturn(Set.of(ACTOR));
		when(nearbyRepository.subscribers(2)).thenReturn(Set.of(ACTOR));
		when(nearbyRepository.hasSubscription(ACTOR)).thenReturn(true);
		when(nearbyPeopleService.open(ACTOR)).thenReturn(snapshot);

		service.handlePositionChanged(moved(1, 10L, 2, 20L));

		InOrder order = inOrder(nearbyRepository, nearbyPeopleService, realtimeMessageService);
		order.verify(nearbyRepository).hasSubscription(ACTOR);
		order.verify(nearbyPeopleService).open(ACTOR);
		order.verify(realtimeMessageService).sendToUser(ACTOR, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_SNAPSHOT, snapshot);
		verifyNoMoreInteractions(realtimeMessageService);
		verifyNoInteractions(userDisplayService, meetingService, riderCountService);
	}

	/**
	 * 같은 층에서 곡만 바꾸면 목록에 담길 사람이 그대로다. 통째로 다시 만들 이유가 없다.
	 * 바뀌는 것은 내 자리에서 잰 거리뿐이고, 받는 쪽이 스스로 다시 잰다.
	 */
	@Test
	@DisplayName("같은 층 안에서는 내 목록을 다시 만들지 않는다")
	void sameLayerDoesNotReissueSnapshot() {
		when(nearbyRepository.subscribers(1)).thenReturn(Set.of(ACTOR));

		service.handlePositionChanged(moved(1, 10L, 1, 20L));

		verify(nearbyRepository, never()).hasSubscription(ACTOR);
		verifyNoInteractions(nearbyPeopleService);
	}

	@Test
	@DisplayName("패널이 닫혀 있으면 층을 옮겨도 목록을 다시 만들지 않는다")
	void closedPanelDoesNotReissueSnapshot() {
		when(nearbyRepository.subscribers(1)).thenReturn(Set.of(ACTOR));
		when(nearbyRepository.subscribers(2)).thenReturn(Set.of(ACTOR));

		service.handlePositionChanged(moved(1, 10L, 2, 20L));

		verify(nearbyRepository).hasSubscription(ACTOR);
		verifyNoInteractions(nearbyPeopleService);
	}

	@Test
	@DisplayName("층도 곡도 그대로면 아무것도 하지 않는다")
	void sameSpotSkipsEverything() {
		service.handlePositionChanged(moved(1, 10L, 1, 10L));

		verifyNoInteractions(nearbyRepository, userDisplayService, realtimeMessageService,
				meetingService, riderCountService, nearbyPeopleService);
	}

	/** 표시축 두 칸에만 값을 넣은 16차원 좌표를 돌려주게 한다. */
	private void givenSpot(long musicId, int layer, double x, double y) {
		double[] pc = new double[16];
		pc[0] = x;
		pc[1] = y;
		when(musicPositionCalculator.findAxes(layer)).thenReturn(new int[] {1, 2});
		when(musicLocationService.findLocation(musicId)).thenReturn(Optional.of(pc));
	}

	private PositionChanged moved(Integer oldLayer, Long oldMusicId, Integer newLayer, Long newMusicId) {
		return new PositionChanged(ACTOR, 1L,
				oldLayer, newLayer,
				oldMusicId, newMusicId,
				oldMusicId == null ? null : "1:1", newMusicId == null ? null : "2:2", 0.2, 0.3);
	}

	// ── 선단이 흩어져 여러 사람이 한꺼번에 나타남 ───────────

	/** 해체는 위치 변경 알림을 거치지 않아, 이걸 안 보내면 목록이 끝내 안 바뀐다. */
	@Test
	@DisplayName("한 덩어리로 나타나면 받는 사람마다 한 번만 보낸다")
	void bulkEnterSendsOneMessagePerReceiver() {
		when(nearbyRepository.subscribers(1)).thenReturn(Set.of("watcher@x.com"));
		when(userDisplayService.find("a@x.com")).thenReturn(new UserDisplay("A", "a.png"));
		when(userDisplayService.find("b@x.com")).thenReturn(new UserDisplay("B", null));
		when(riderCountService.countAll(List.of("a@x.com", "b@x.com")))
				.thenReturn(Map.of("a@x.com", 2));
		when(meetingService.countWith("watcher@x.com", "a@x.com")).thenReturn(3);
		when(meetingService.countWith("watcher@x.com", "b@x.com")).thenReturn(0);
		givenSpot(100L, 1, 7.0, 8.0);

		service.sendEnteredTogether(List.of("a@x.com", "b@x.com"), 1, 100L);

		ArgumentCaptor<NearbyBulkEnter> captor = ArgumentCaptor.forClass(NearbyBulkEnter.class);
		verify(realtimeMessageService).sendToUser(eq("watcher@x.com"), anyString(),
				eq(RealtimeMessageType.NEARBY_BULK_ENTER), captor.capture());
		assertThat(captor.getValue().musicId()).isEqualTo(100L);
		assertThat(captor.getValue().people()).extracting(NearbyChange::email)
				.containsExactly("a@x.com", "b@x.com");
		assertThat(captor.getValue().people().get(0).riderCount()).isEqualTo(2);
		assertThat(captor.getValue().people().get(0).meetingCount()).isEqualTo(3);
		assertThat(captor.getValue().people().get(1).riderCount()).isZero();
		// 한 곡에 같이 나타났으므로 자리도 하나다
		assertThat(captor.getValue().people()).allSatisfy(person -> {
			assertThat(person.x()).isEqualTo(7.0);
			assertThat(person.y()).isEqualTo(8.0);
		});
	}

	/** 자기가 나타난 것을 자기가 받을 이유가 없다. */
	@Test
	@DisplayName("나타난 본인은 받지 않는다")
	void bulkEnterSkipsTheArrivalsThemselves() {
		when(nearbyRepository.subscribers(1)).thenReturn(Set.of("a@x.com"));

		service.sendEnteredTogether(List.of("a@x.com"), 1, 100L);

		verifyNoInteractions(realtimeMessageService, userDisplayService, meetingService);
	}

	@Test
	@DisplayName("보는 사람이 없으면 아무것도 읽지 않는다")
	void bulkEnterWithoutSubscribersDoesNothing() {
		when(nearbyRepository.subscribers(1)).thenReturn(Set.of());

		service.sendEnteredTogether(List.of("a@x.com"), 1, 100L);

		verifyNoInteractions(realtimeMessageService, userDisplayService, riderCountService);
	}

	@Test
	@DisplayName("나타난 사람이 없으면 보는 사람도 찾지 않는다")
	void bulkEnterWithoutArrivalsDoesNothing() {
		service.sendEnteredTogether(List.of(), 1, 100L);

		verifyNoInteractions(nearbyRepository, realtimeMessageService);
	}

	/** 곡도 자리도 그대로다. 목록에서 숫자만 바꾸면 된다. */
	@Test
	@DisplayName("인원수 변화를 그 곡을 보는 사람들에게 알린다")
	void riderCountReachesSubscribers() {
		when(nearbyRepository.subscribers(1))
				.thenReturn(Set.of("watcher@x.com", "captain@x.com"));

		service.sendRiderCount("captain@x.com", 1, 100L, 3);

		verify(realtimeMessageService).sendToUser(eq("watcher@x.com"), anyString(),
				eq(RealtimeMessageType.NEARBY_RIDER_COUNT),
				eq(new NearbyRiderCount("captain@x.com", 3, 100L)));
		verify(realtimeMessageService, never()).sendToUser(eq("captain@x.com"), anyString(),
				eq(RealtimeMessageType.NEARBY_RIDER_COUNT), any());
	}
}
