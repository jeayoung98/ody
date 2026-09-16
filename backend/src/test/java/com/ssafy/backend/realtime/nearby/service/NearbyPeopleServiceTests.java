package com.ssafy.backend.realtime.nearby.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.meeting.MeetingService;
import com.ssafy.backend.realtime.nearby.dto.NearbyPerson;
import com.ssafy.backend.realtime.nearby.dto.NearbySnapshot;
import com.ssafy.backend.realtime.nearby.port.NeighborPort;
import com.ssafy.backend.realtime.nearby.port.NeighborPort.NeighborSong;
import com.ssafy.backend.realtime.nearby.port.RiderCountPort;
import com.ssafy.backend.realtime.nearby.repository.NearbyRedisRepository;
import com.ssafy.backend.realtime.presence.dto.UserView;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.session.WebSocketSessionRegistry;
import com.ssafy.backend.realtime.user.UserDisplayResolver;

/**
 * 주변사람 목록 만드는 로직만 따로 검증. DB·Redis 안 붙이고 가짜(mock)로 채운다. CI 안전.
 */
@ExtendWith(MockitoExtension.class)
class NearbyPeopleServiceTests {

    @Mock PresenceRedisRepository presenceRepo;
    @Mock NeighborPort neighborPort;
    @Mock NearbyRedisRepository nearbyRepo;
    @Mock UserDisplayResolver userDisplayResolver;
    @Mock MeetingService meetingService;
    @Mock RiderCountPort riderCountPort;
    @Mock WebSocketSessionRegistry sessionRegistry;
    @InjectMocks NearbyPeopleService service;

    private static final String ME = "me@x.com";

    @Test
    @DisplayName("재생 중인 곡이 없으면 PRESENCE_ERROR 로 막는다")
    void noAnchor() {
        when(presenceRepo.snapshot(ME)).thenReturn(null);

        assertThatThrownBy(() -> service.open(ME))
                .isInstanceOfSatisfying(CustomException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.PRESENCE_ERROR));
    }

    @Test
    @DisplayName("곡별 듣는 사람을 평면 목록으로 주고, 나 자신은 뺀다")
    void flatListExcludesSelf() {
        when(presenceRepo.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 1L));
        when(neighborPort.anchorAndNeighbors(100L)).thenReturn(List.of(
                new NeighborSong(100L, "내 곡", "가수A", new double[16], 0.0),
                new NeighborSong(200L, "비슷한 곡", "가수B", new double[16], 0.5)));
        when(nearbyRepo.replaceSubscriptions(ME, 1L, List.of(100L, 200L))).thenReturn(true);
        when(sessionRegistry.currentSeq(ME)).thenReturn(7L);
        when(nearbyRepo.listeners(List.of(100L, 200L))).thenReturn(Map.of(
                100L, Set.of(ME, "u1@x.com"),
                200L, Set.of("u2@x.com")));
        when(userDisplayResolver.resolve("u1@x.com")).thenReturn(new UserView("nick1", "img1"));
        when(userDisplayResolver.resolve("u2@x.com")).thenReturn(new UserView("nick2", "img2"));
        when(meetingService.countWith(ME, "u1@x.com")).thenReturn(4);
        when(meetingService.countWith(ME, "u2@x.com")).thenReturn(1);
        when(riderCountPort.count("u1@x.com")).thenReturn(2);

        NearbySnapshot res = service.open(ME);

        assertThat(res.anchorMusicId()).isEqualTo(100L);
        assertThat(res.snapshotSeq()).isEqualTo(7L);
        assertThat(res.people()).extracting(NearbyPerson::nickname)
                .containsExactlyInAnyOrder("nick1", "nick2"); // 나(ME)는 없음
        assertThat(res.people()).filteredOn(person -> person.email().equals("u1@x.com"))
                .singleElement()
                .satisfies(person -> {
                    assertThat(person.meetingCount()).isEqualTo(4);
                    assertThat(person.riderCount()).isEqualTo(2);
                });
    }

    @Test
    @DisplayName("듣는 사람이 나뿐인 곡은 목록에서 통째로 빠진다")
    void songWithOnlyMeSkipped() {
        when(presenceRepo.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 1L));
        when(neighborPort.anchorAndNeighbors(100L)).thenReturn(List.of(
                new NeighborSong(100L, "내 곡", "가수A", new double[16], 0.0)));
        when(nearbyRepo.replaceSubscriptions(ME, 1L, List.of(100L))).thenReturn(true);
        when(nearbyRepo.listeners(List.of(100L))).thenReturn(Map.of(100L, Set.of(ME)));

        assertThat(service.open(ME).people()).isEmpty();
    }

    @Test
    @DisplayName("비슷한 곡 찾기가 실패하면 빈 목록 대신 SERVICE_UNAVAILABLE")
    void neighborFailure() {
        when(presenceRepo.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 1L));
        when(neighborPort.anchorAndNeighbors(100L)).thenThrow(new UnsupportedOperationException("어댑터 대기중"));

        assertThatThrownBy(() -> service.open(ME))
                .isInstanceOfSatisfying(CustomException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.SERVICE_UNAVAILABLE));
    }

    @Test
    @DisplayName("현재 접속의 구독을 듣는 사람 조회보다 먼저 바꾼다")
    void subscriptionIsSavedBeforeListenersAreRead() {
        when(presenceRepo.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 1L));
        when(neighborPort.anchorAndNeighbors(100L)).thenReturn(List.of(
                new NeighborSong(100L, "내 곡", "가수A", new double[16], 0.0),
                new NeighborSong(200L, "비슷한 곡", "가수B", new double[16], 0.5)));
        when(nearbyRepo.replaceSubscriptions(ME, 1L, List.of(100L, 200L))).thenReturn(true);
        when(nearbyRepo.listeners(List.of(100L, 200L))).thenReturn(Map.of());

        service.open(ME);

        InOrder order = inOrder(nearbyRepo, sessionRegistry);
        order.verify(nearbyRepo).replaceSubscriptions(ME, 1L, List.of(100L, 200L));
        order.verify(sessionRegistry).currentSeq(ME);
        order.verify(nearbyRepo).listeners(List.of(100L, 200L));
    }

    @Test
    @DisplayName("다시 열면 새 곡을 먼저 구독하고 더 이상 보지 않는 옛 곡을 해제한다")
    void reopenReplacesOldSubscriptions() {
        when(presenceRepo.snapshot(ME)).thenReturn(new PresenceSnapshot(200L, 1, 0, 0, 1L));
        when(neighborPort.anchorAndNeighbors(200L)).thenReturn(List.of(
                new NeighborSong(200L, "새 내 곡", "가수B", new double[16], 0.0),
                new NeighborSong(300L, "새 비슷한 곡", "가수C", new double[16], 0.4)));
        when(nearbyRepo.replaceSubscriptions(ME, 1L, List.of(200L, 300L))).thenReturn(true);
        when(nearbyRepo.listeners(List.of(200L, 300L))).thenReturn(Map.of());

        service.open(ME);

        InOrder order = inOrder(nearbyRepo);
        order.verify(nearbyRepo).replaceSubscriptions(ME, 1L, List.of(200L, 300L));
        order.verify(nearbyRepo).listeners(List.of(200L, 300L));
    }

	@Test
	@DisplayName("접속이 바뀌면 구독과 목록 조회를 막는다")
	void staleEpochStopsBeforeListenersAreRead() {
		when(presenceRepo.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 7L));
		when(neighborPort.anchorAndNeighbors(100L)).thenReturn(List.of(
				new NeighborSong(100L, "내 곡", "가수A", new double[16], 0.0)));
		when(nearbyRepo.replaceSubscriptions(ME, 7L, List.of(100L))).thenReturn(false);

		assertThatThrownBy(() -> service.open(ME))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.PRESENCE_ERROR));

		verify(nearbyRepo).replaceSubscriptions(ME, 7L, List.of(100L));
		verifyNoMoreInteractions(nearbyRepo);
	}

	@Test
	@DisplayName("닫기는 현재 접속 버전으로 구독을 해제한다")
	void closeUsesCurrentEpoch() {
		when(nearbyRepo.closeSubscriptions(ME, 7L)).thenReturn(true);

		service.close(ME, 7L);

		verify(nearbyRepo).closeSubscriptions(ME, 7L);
		verifyNoInteractions(presenceRepo, neighborPort, userDisplayResolver,
				meetingService, riderCountPort, sessionRegistry);
	}
}
