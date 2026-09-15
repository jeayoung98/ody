package com.ssafy.backend.realtime.nearby.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
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
import com.ssafy.backend.realtime.common.RealtimeErrorCode;
import com.ssafy.backend.realtime.common.UserDisplayResolver;
import com.ssafy.backend.realtime.nearby.dto.NearbyPerson;
import com.ssafy.backend.realtime.nearby.dto.NearbySnapshot;
import com.ssafy.backend.realtime.nearby.port.NeighborPort;
import com.ssafy.backend.realtime.nearby.port.NeighborPort.NeighborSong;
import com.ssafy.backend.realtime.nearby.repository.NearbyRedisRepository;
import com.ssafy.backend.realtime.presence.dto.UserView;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository.PresenceSnapshot;

/**
 * 주변사람 목록 만드는 로직만 따로 검증. DB·Redis 안 붙이고 가짜(mock)로 채운다. CI 안전.
 */
@ExtendWith(MockitoExtension.class)
class NearbyPeopleServiceTests {

    @Mock PresenceRedisRepository presenceRepo;
    @Mock NeighborPort neighborPort;
    @Mock NearbyRedisRepository nearbyRepo;
    @Mock UserDisplayResolver userDisplayResolver;
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
        when(nearbyRepo.listeners(List.of(100L, 200L))).thenReturn(Map.of(
                100L, Set.of(ME, "u1@x.com"),
                200L, Set.of("u2@x.com")));
        when(userDisplayResolver.resolve("u1@x.com")).thenReturn(new UserView("nick1", "img1"));
        when(userDisplayResolver.resolve("u2@x.com")).thenReturn(new UserView("nick2", "img2"));

        NearbySnapshot res = service.open(ME);

        assertThat(res.anchorMusicId()).isEqualTo(100L);
        assertThat(res.people()).extracting(NearbyPerson::nickname)
                .containsExactlyInAnyOrder("nick1", "nick2"); // 나(ME)는 없음
    }

    @Test
    @DisplayName("듣는 사람이 나뿐인 곡은 목록에서 통째로 빠진다")
    void songWithOnlyMeSkipped() {
        when(presenceRepo.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 1L));
        when(neighborPort.anchorAndNeighbors(100L)).thenReturn(List.of(
                new NeighborSong(100L, "내 곡", "가수A", new double[16], 0.0)));
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
    @DisplayName("구독 등록과 meta 저장을 듣는 사람 조회보다 먼저 한다")
    void subscriptionIsSavedBeforeListenersAreRead() {
        when(presenceRepo.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, 1, 0, 0, 1L));
        when(neighborPort.anchorAndNeighbors(100L)).thenReturn(List.of(
                new NeighborSong(100L, "내 곡", "가수A", new double[16], 0.0),
                new NeighborSong(200L, "비슷한 곡", "가수B", new double[16], 0.5)));
        when(nearbyRepo.subscribedMusicIds(ME)).thenReturn(List.of());
        when(nearbyRepo.listeners(List.of(100L, 200L))).thenReturn(Map.of());

        service.open(ME);

        InOrder order = inOrder(nearbyRepo);
        order.verify(nearbyRepo).subscribedMusicIds(ME);
        order.verify(nearbyRepo).subscribe(ME, List.of(100L, 200L));
        order.verify(nearbyRepo).saveMeta(ME, List.of(100L, 200L));
        order.verify(nearbyRepo).listeners(List.of(100L, 200L));
    }

    @Test
    @DisplayName("다시 열면 새 곡을 먼저 구독하고 더 이상 보지 않는 옛 곡을 해제한다")
    void reopenReplacesOldSubscriptions() {
        when(presenceRepo.snapshot(ME)).thenReturn(new PresenceSnapshot(200L, 1, 0, 0, 1L));
        when(neighborPort.anchorAndNeighbors(200L)).thenReturn(List.of(
                new NeighborSong(200L, "새 내 곡", "가수B", new double[16], 0.0),
                new NeighborSong(300L, "새 비슷한 곡", "가수C", new double[16], 0.4)));
        when(nearbyRepo.subscribedMusicIds(ME)).thenReturn(List.of(100L, 200L));
        when(nearbyRepo.listeners(List.of(200L, 300L))).thenReturn(Map.of());

        service.open(ME);

        InOrder order = inOrder(nearbyRepo);
        order.verify(nearbyRepo).subscribe(ME, List.of(200L, 300L));
        order.verify(nearbyRepo).unsubscribe(ME, Set.of(100L));
        order.verify(nearbyRepo).saveMeta(ME, List.of(200L, 300L));
        order.verify(nearbyRepo).listeners(List.of(200L, 300L));
        verify(nearbyRepo).subscribedMusicIds(ME);
    }
}
