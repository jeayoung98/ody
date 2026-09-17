package com.ssafy.backend.realtime.service.presence;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
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
import com.ssafy.backend.realtime.dto.presence.JoinRequest;
import com.ssafy.backend.realtime.dto.presence.PresenceJoined;
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
	@InjectMocks PresenceService service;

	@BeforeEach
	void setUp() {
		ReflectionTestUtils.setField(service, "ttlMs", 45_000L);
	}

	@Test
	@DisplayName("다시 연결하면 이전 위치를 지우고 퇴장을 알린 뒤 새 접속을 만든다")
	void reconnectRemovesPreviousPositionBeforeConnecting() {
		when(presenceRepository.snapshot(EMAIL))
				.thenReturn(new PresenceSnapshot(20L, 2, 3, 4, 7L));
		when(presenceRepository.applyLeave(EMAIL, 7L))
				.thenReturn(List.of("20", "2", "3", "4", "7"));

		service.connect(EMAIL, 8L);

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

		service.connect(EMAIL, 1L);

		verify(presenceRepository).connect(EMAIL, 1L, 45_000L);
		verifyNoInteractions(realtimeEventService);
	}

	@Test
	@DisplayName("첫 곡 배치가 끝나면 진입을 알린다")
	void firstJoinPublishesEnter() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
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
}
