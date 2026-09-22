package com.ssafy.backend.realtime.service.nearby;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
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
import com.ssafy.backend.realtime.service.meeting.MeetingService;
import com.ssafy.backend.realtime.dto.nearby.NearbyPerson;
import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.service.nearby.NearbyMusicService;
import com.ssafy.backend.realtime.service.nearby.NearbyMusicService.NearbyMusic;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.repository.redis.NearbyRedisRepository;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.session.WebSocketSessionService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

/**
 * 주변사람 목록 만드는 로직만 따로 검증. DB·Redis 안 붙이고 가짜(mock)로 채운다. CI 안전.
 */
@ExtendWith(MockitoExtension.class)
class NearbyPeopleServiceTests {

    @Mock PresenceRedisRepository presenceRepository;
    @Mock NearbyMusicService nearbyMusicService;
    @Mock NearbyRedisRepository nearbyRepository;
    @Mock UserDisplayService userDisplayService;
    @Mock MeetingService meetingService;
    @Mock RiderCountService riderCountService;
    @Mock WebSocketSessionService webSocketSessionService;
    @InjectMocks NearbyPeopleService service;

    private static final String ME = "me@x.com";

    @Test
    @DisplayName("재생 중인 곡이 없으면 PRESENCE_ERROR 로 막는다")
    void noAnchor() {
        when(presenceRepository.snapshot(ME)).thenReturn(null);

        assertThatThrownBy(() -> service.open(ME))
                .isInstanceOfSatisfying(CustomException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.PRESENCE_ERROR));
    }

    @Test
    @DisplayName("곡별 듣는 사람을 평면 목록으로 주고, 나 자신은 뺀다")
    void flatListExcludesSelf() {
        when(presenceRepository.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 1L));
        when(nearbyMusicService.findCurrentAndNearbyMusic(100L)).thenReturn(List.of(
                new NearbyMusic(100L, "내 곡", "가수A", new double[16], 0.0),
                new NearbyMusic(200L, "비슷한 곡", "가수B", new double[16], 0.5)));
        when(nearbyRepository.replaceSubscriptions(ME, 1L, List.of(100L, 200L))).thenReturn(true);
        when(webSocketSessionService.currentMessageSeq(ME)).thenReturn(7L);
        when(nearbyRepository.listeners(List.of(100L, 200L))).thenReturn(Map.of(
                100L, Set.of(ME, "u1@x.com"),
                200L, Set.of("u2@x.com")));
        when(userDisplayService.find("u1@x.com")).thenReturn(new UserDisplay("nick1", "img1"));
        when(userDisplayService.find("u2@x.com")).thenReturn(new UserDisplay("nick2", "img2"));
        when(meetingService.countWith(ME, "u1@x.com")).thenReturn(4);
        when(meetingService.countWith(ME, "u2@x.com")).thenReturn(1);
        when(riderCountService.countAll(anyCollection())).thenReturn(Map.of("u1@x.com", 2));

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
        when(presenceRepository.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 1L));
        when(nearbyMusicService.findCurrentAndNearbyMusic(100L)).thenReturn(List.of(
                new NearbyMusic(100L, "내 곡", "가수A", new double[16], 0.0)));
        when(nearbyRepository.replaceSubscriptions(ME, 1L, List.of(100L))).thenReturn(true);
        when(nearbyRepository.listeners(List.of(100L))).thenReturn(Map.of(100L, Set.of(ME)));

        assertThat(service.open(ME).people()).isEmpty();
    }

    @Test
    @DisplayName("비슷한 곡 찾기가 실패하면 빈 목록 대신 SERVICE_UNAVAILABLE")
    void neighborFailure() {
        when(presenceRepository.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 1L));
        when(nearbyMusicService.findCurrentAndNearbyMusic(100L)).thenThrow(new UnsupportedOperationException("구현 대기중"));

        assertThatThrownBy(() -> service.open(ME))
                .isInstanceOfSatisfying(CustomException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.SERVICE_UNAVAILABLE));
    }

    @Test
    @DisplayName("현재 접속의 구독을 듣는 사람 조회보다 먼저 바꾼다")
    void subscriptionIsSavedBeforeListenersAreRead() {
        when(presenceRepository.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 1L));
        when(nearbyMusicService.findCurrentAndNearbyMusic(100L)).thenReturn(List.of(
                new NearbyMusic(100L, "내 곡", "가수A", new double[16], 0.0),
                new NearbyMusic(200L, "비슷한 곡", "가수B", new double[16], 0.5)));
        when(nearbyRepository.replaceSubscriptions(ME, 1L, List.of(100L, 200L))).thenReturn(true);
        when(nearbyRepository.listeners(List.of(100L, 200L))).thenReturn(Map.of());

        service.open(ME);

        InOrder order = inOrder(nearbyRepository, webSocketSessionService);
        order.verify(nearbyRepository).replaceSubscriptions(ME, 1L, List.of(100L, 200L));
        order.verify(webSocketSessionService).currentMessageSeq(ME);
        order.verify(nearbyRepository).listeners(List.of(100L, 200L));
    }

    @Test
    @DisplayName("다시 열면 새 곡을 먼저 구독하고 더 이상 보지 않는 옛 곡을 해제한다")
    void reopenReplacesOldSubscriptions() {
        when(presenceRepository.snapshot(ME)).thenReturn(new PresenceSnapshot(200L, 1, 0, 0, 1L));
        when(nearbyMusicService.findCurrentAndNearbyMusic(200L)).thenReturn(List.of(
                new NearbyMusic(200L, "새 내 곡", "가수B", new double[16], 0.0),
                new NearbyMusic(300L, "새 비슷한 곡", "가수C", new double[16], 0.4)));
        when(nearbyRepository.replaceSubscriptions(ME, 1L, List.of(200L, 300L))).thenReturn(true);
        when(nearbyRepository.listeners(List.of(200L, 300L))).thenReturn(Map.of());

        service.open(ME);

        InOrder order = inOrder(nearbyRepository);
        order.verify(nearbyRepository).replaceSubscriptions(ME, 1L, List.of(200L, 300L));
        order.verify(nearbyRepository).listeners(List.of(200L, 300L));
    }

	@Test
	@DisplayName("접속이 바뀌면 구독과 목록 조회를 막는다")
	void staleEpochStopsBeforeListenersAreRead() {
		when(presenceRepository.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 7L));
		when(nearbyMusicService.findCurrentAndNearbyMusic(100L)).thenReturn(List.of(
				new NearbyMusic(100L, "내 곡", "가수A", new double[16], 0.0)));
		when(nearbyRepository.replaceSubscriptions(ME, 7L, List.of(100L))).thenReturn(false);

		assertThatThrownBy(() -> service.open(ME))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.PRESENCE_ERROR));

		verify(nearbyRepository).replaceSubscriptions(ME, 7L, List.of(100L));
		verifyNoMoreInteractions(nearbyRepository);
	}

	@Test
	@DisplayName("닫기는 현재 접속 버전으로 구독을 해제한다")
	void closeUsesCurrentEpoch() {
		when(nearbyRepository.closeSubscriptions(ME, 7L)).thenReturn(true);

		service.close(ME, 7L);

		verify(nearbyRepository).closeSubscriptions(ME, 7L);
		verifyNoInteractions(presenceRepository, nearbyMusicService, userDisplayService,
				meetingService, riderCountService, webSocketSessionService);
	}
}
