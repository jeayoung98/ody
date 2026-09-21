package com.ssafy.backend.realtime.service.presence;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.ride.RideService;
import com.ssafy.backend.realtime.dto.presence.JoinRequest;
import com.ssafy.backend.realtime.dto.presence.PresenceJoined;
import com.ssafy.backend.realtime.repository.mapper.PlayHistoryMapper;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;

/** 곡 청취자 진입과 퇴장 알림을 검증한다. */
@ExtendWith(MockitoExtension.class)
class PresenceServiceTests {

	private static final String EMAIL = "user@x.com";

	@Mock PresenceRedisRepository presenceRepository;
	@Mock MusicLocationService musicLocationService;
	@Mock MusicPositionCalculator musicPositionCalculator;
	@Mock RealtimeEventService realtimeEventService;
	@Mock PlayHistoryMapper playHistoryMapper; // 첫 입장 때 마지막 재생곡
	@Mock RideService rideService; // 나가는 사람의 따라가기 정리
	@InjectMocks PresenceService service;

	@BeforeEach
	void setUp() {
		ReflectionTestUtils.setField(service, "ttlMs", 45_000L);
	}

	@Test
	@DisplayName("다른 탭 없이 다시 연결하면 이전 위치를 지우고 퇴장을 알린 뒤 새 접속을 만든다")
	void reconnectRemovesPreviousPositionBeforeConnecting() {
		when(presenceRepository.snapshot(EMAIL))
				.thenReturn(new PresenceSnapshot(20L, 2, 3, 4, 7L));
		when(presenceRepository.applyLeave(EMAIL, 7L))
				.thenReturn(List.of("20", "2", "3", "4", "7"));

		service.connect(EMAIL, 8L, false);

		verify(presenceRepository).applyLeave(EMAIL, 7L);
		verify(presenceRepository).connect(EMAIL, 8L, 45_000L);
		verify(realtimeEventService).send(new PositionChanged(
				EMAIL, 7L, 2, null,
				20L, null,
				"3:4", null,
				null, null));
	}

	@Test
	@DisplayName("첫 연결은 정리 없이 새 접속만 만든다")
	void firstConnectCreatesPresenceWithoutLeave() {
		when(presenceRepository.snapshot(EMAIL)).thenReturn(null);

		service.connect(EMAIL, 1L, false);

		verify(presenceRepository).connect(EMAIL, 1L, 45_000L);
		verifyNoInteractions(realtimeEventService);
	}

	@Test
	@DisplayName("다른 탭이 남아 있으면 이전 위치를 읽지도 지우지도 않는다")
	void connectKeepsPositionWhenOtherTabRemains() {
		service.connect(EMAIL, 9L, true);

		verify(presenceRepository).connect(EMAIL, 9L, 45_000L);
		verify(presenceRepository, never()).snapshot(EMAIL);
		verify(presenceRepository, never()).applyLeave(anyString(), anyLong());
		verifyNoInteractions(realtimeEventService);
	}

	@Test
	@DisplayName("첫 입장은 마지막 재생 기록의 곡에 놓고 진입을 알린다")
	void firstJoinPublishesEnter() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(playHistoryMapper.findLatestMusicId(EMAIL)).thenReturn(20L);
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, 2)).thenReturn(placement);
		when(presenceRepository.snapshot(EMAIL)).thenReturn(new PresenceSnapshot(null, null, null, null, 7L));
		when(presenceRepository.join(EMAIL, 7L, null, null, null, null,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(true);

		PresenceJoined result = service.join(EMAIL, 7L, new JoinRequest(1L, 2, 20L));

		assertThat(result).isEqualTo(new PresenceJoined(1L, 2, 20L));
		verify(realtimeEventService).send(new PositionChanged(
				EMAIL, 7L, null, 2,
				null, 20L,
				null, "2:7",
				0.2, 0.7));
	}

	@Test
	@DisplayName("첫 입장에서 요청 곡이 기록과 다르면 기록의 곡을 쓴다")
	void firstJoinIgnoresRequestedMusicWhenHistoryDiffers() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(playHistoryMapper.findLatestMusicId(EMAIL)).thenReturn(20L);
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, 2)).thenReturn(placement);
		when(presenceRepository.snapshot(EMAIL)).thenReturn(new PresenceSnapshot(null, null, null, null, 7L));
		when(presenceRepository.join(EMAIL, 7L, null, null, null, null,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(true);

		// 클라가 99번 곡을 주장해도 기록(20)이 이긴다.
		PresenceJoined result = service.join(EMAIL, 7L, new JoinRequest(1L, 2, 99L));

		assertThat(result.musicId()).isEqualTo(20L);
		verify(musicLocationService).findLocation(20L);
		verify(musicLocationService, never()).findLocation(99L);
	}

	@Test
	@DisplayName("재생 기록이 없으면 첫 입장을 거부한다")
	void firstJoinWithoutHistoryIsRejected() {
		when(presenceRepository.snapshot(EMAIL)).thenReturn(new PresenceSnapshot(null, null, null, null, 7L));
		when(playHistoryMapper.findLatestMusicId(EMAIL)).thenReturn(null);

		assertThatThrownBy(() -> service.join(EMAIL, 7L, new JoinRequest(1L, 2, 20L)))
				.isInstanceOfSatisfying(WebSocketRequestException.class,
						e -> assertThat(e.getCode()).isEqualTo(WebSocketErrorCode.PRESENCE_NO_ANCHOR));

		verifyNoInteractions(musicLocationService, musicPositionCalculator, realtimeEventService);
		// 접속 확인(snapshot)만 하고 Redis 위치는 건드리지 않는다.
		verify(presenceRepository).snapshot(EMAIL);
		verifyNoMoreInteractions(presenceRepository);
	}

	@Test
	@DisplayName("레이어를 옮길 때 요청 곡이 달라도 서버의 현재 곡을 유지한다")
	void layerChangePublishesMove() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, 2)).thenReturn(placement);
		when(presenceRepository.snapshot(EMAIL)).thenReturn(new PresenceSnapshot(20L, 1, 1, 1, 7L));
		when(presenceRepository.join(EMAIL, 7L, 20L, 1, 1, 1,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(true);

		PresenceJoined result = service.join(EMAIL, 7L, new JoinRequest(2L, 2, 99L));

		assertThat(result).isEqualTo(new PresenceJoined(2L, 2, 20L));
		verify(musicLocationService).findLocation(20L);
		// 이미 서 있으면 재생 기록을 찾아볼 필요가 없다.
		verifyNoInteractions(playHistoryMapper);
		verify(realtimeEventService).send(new PositionChanged(
				EMAIL, 7L, 1, 2,
				20L, 20L,
				"1:1", "2:7",
				0.2, 0.7));
	}

	@Test
	@DisplayName("곡과 레이어와 셀이 같으면 위치 변경을 알리지 않는다")
	void samePositionDoesNotPublishMove() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, 2)).thenReturn(placement);
		when(presenceRepository.snapshot(EMAIL)).thenReturn(new PresenceSnapshot(20L, 2, 2, 7, 7L));
		when(presenceRepository.join(EMAIL, 7L, 20L, 2, 2, 7,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(true);

		service.join(EMAIL, 7L, new JoinRequest(3L, 2, 20L));

		verifyNoInteractions(realtimeEventService);
	}

	@Test
	@DisplayName("이전 소켓의 입장 요청은 위치를 읽은 뒤 바로 거부한다")
	void staleConnectionCannotJoin() {
		when(presenceRepository.snapshot(EMAIL))
				.thenReturn(new PresenceSnapshot(20L, 1, 1, 1, 8L));

		assertThatThrownBy(() -> service.join(EMAIL, 7L, new JoinRequest(4L, 2, 20L)))
				.isInstanceOfSatisfying(WebSocketRequestException.class,
						e -> assertThat(e.getCode()).isEqualTo(WebSocketErrorCode.PRESENCE_STALE));

		verifyNoInteractions(musicLocationService, musicPositionCalculator, realtimeEventService);
	}

	@Test
	@DisplayName("입장 처리 중 현재 곡이 바뀌면 늦은 요청을 거부한다")
	void changedStateCannotJoin() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(presenceRepository.snapshot(EMAIL))
				.thenReturn(new PresenceSnapshot(20L, 1, 1, 1, 7L));
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, 2)).thenReturn(placement);
		when(presenceRepository.join(EMAIL, 7L, 20L, 1, 1, 1,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(false);

		assertThatThrownBy(() -> service.join(EMAIL, 7L, new JoinRequest(5L, 2, 99L)))
				.isInstanceOfSatisfying(WebSocketRequestException.class,
						e -> assertThat(e.getCode()).isEqualTo(WebSocketErrorCode.PRESENCE_STALE));

		verifyNoInteractions(realtimeEventService);
	}

	@Test
	@DisplayName("직접 종료로 사용자를 지우면 퇴장을 알린다")
	void leavePublishesRemovedPosition() {
		when(presenceRepository.applyLeave(EMAIL, 7L))
				.thenReturn(List.of("20", "2", "3", "4", "7"));

		service.leave(EMAIL, 7L);

		verify(realtimeEventService).send(new PositionChanged(
				EMAIL, 7L, 2, null,
				20L, null,
				"3:4", null,
				null, null));
	}

	@Test
	@DisplayName("만료된 사용자를 지우면 퇴장을 알린다")
	void expiredLeavePublishesRemovedPosition() {
		when(presenceRepository.applyLeaveExpired(EMAIL, 1000L))
				.thenReturn(List.of("20", "2", "3", "4", "7"));

		service.leaveExpired(EMAIL, 1000L);

		verify(realtimeEventService).send(new PositionChanged(
				EMAIL, 7L, 2, null,
				20L, null,
				"3:4", null,
				null, null));
	}

	@Test
	@DisplayName("지운 사용자가 없으면 퇴장을 알리지 않는다")
	void noRemovedPresenceDoesNotPublishLeave() {
		when(presenceRepository.applyLeave(EMAIL, 7L)).thenReturn(List.of());

		service.leave(EMAIL, 7L);

		verifyNoInteractions(realtimeEventService);
	}

	/** 연결 종료와 접속 만료가 같은 길로 가야 한 쪽만 고쳐지는 사고가 없다. */
	@Test
	@DisplayName("연결이 끊기면 따라가기도 정리한다")
	void leaveCleansUpRide() {
		service.leave(EMAIL, 7L);

		verify(rideService).onUserGone(EMAIL);
	}

	@Test
	@DisplayName("접속이 만료돼도 같은 정리를 한다")
	void expiredLeaveCleansUpRide() {
		service.leaveExpired(EMAIL, 1000L);

		verify(rideService).onUserGone(EMAIL);
	}
}
