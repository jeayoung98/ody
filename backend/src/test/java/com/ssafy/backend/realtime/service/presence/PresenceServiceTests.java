package com.ssafy.backend.realtime.service.presence;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.dto.presence.JoinRequest;
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

	@Test
	@DisplayName("첫 곡 배치가 끝나면 진입을 알린다")
	void firstJoinPublishesEnter() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, 2)).thenReturn(placement);
		when(presenceRepository.snapshot(EMAIL)).thenReturn(new PresenceSnapshot(null, null, null, null, 7L));
		when(presenceRepository.join(EMAIL, null, null, null, null,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(true);

		service.join(EMAIL, new JoinRequest(2, 20L));

		verify(realtimeEventService).send(new PositionChanged(
				EMAIL, 7L, null, 2,
				null, 20L,
				null, "2:7",
				0.2, 0.7));
	}

	@Test
	@DisplayName("레이어를 옮기면 이전 위치와 새 위치를 알린다")
	void layerChangePublishesMove() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, 2)).thenReturn(placement);
		when(presenceRepository.snapshot(EMAIL)).thenReturn(new PresenceSnapshot(20L, 1, 1, 1, 7L));
		when(presenceRepository.join(EMAIL, 20L, 1, 1, 1,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(true);

		service.join(EMAIL, new JoinRequest(2, 20L));

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
		when(presenceRepository.join(EMAIL, 20L, 2, 2, 7,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(true);

		service.join(EMAIL, new JoinRequest(2, 20L));

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
