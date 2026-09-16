package com.ssafy.backend.realtime.presence.service;

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
import com.ssafy.backend.realtime.event.RealtimeEventBus;
import com.ssafy.backend.realtime.geometry.CoordinateMapper;
import com.ssafy.backend.realtime.geometry.CoordinateMapper.Placement;
import com.ssafy.backend.realtime.port.MusicLocationPort;
import com.ssafy.backend.realtime.presence.dto.JoinRequest;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository.PresenceSnapshot;

/** 곡 청취자 진입과 퇴장 알림을 검증한다. */
@ExtendWith(MockitoExtension.class)
class PresenceLifecycleServiceTests {

	private static final String EMAIL = "user@x.com";

	@Mock PresenceRedisRepository presenceRepo;
	@Mock MusicLocationPort musicLocationPort;
	@Mock CoordinateMapper coordinateMapper;
	@Mock RealtimeEventBus eventBus;
	@InjectMocks PresenceLifecycleService service;

	@Test
	@DisplayName("첫 곡 배치가 끝나면 진입을 알린다")
	void firstJoinPublishesEnter() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(musicLocationPort.findLocation(20L)).thenReturn(Optional.of(location));
		when(coordinateMapper.place(location, 2)).thenReturn(placement);
		when(presenceRepo.snapshot(EMAIL)).thenReturn(new PresenceSnapshot(null, null, null, null, 7L));
		when(presenceRepo.join(EMAIL, null, null, null, null,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(true);

		service.join(EMAIL, new JoinRequest(2, 20L));

		verify(eventBus).publish(new PositionChanged(
				EMAIL, 7L, 2,
				null, 20L,
				null, "2:7",
				0.2, 0.7));
	}

	@Test
	@DisplayName("이미 곡에 배치된 사용자는 진입을 다시 알리지 않는다")
	void existingJoinDoesNotPublishEnter() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(musicLocationPort.findLocation(20L)).thenReturn(Optional.of(location));
		when(coordinateMapper.place(location, 2)).thenReturn(placement);
		when(presenceRepo.snapshot(EMAIL)).thenReturn(new PresenceSnapshot(20L, 1, 1, 1, 7L));
		when(presenceRepo.join(EMAIL, 20L, 1, 1, 1,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(true);

		service.join(EMAIL, new JoinRequest(2, 20L));

		verifyNoInteractions(eventBus);
	}

	@Test
	@DisplayName("직접 종료로 사용자를 지우면 퇴장을 알린다")
	void leavePublishesRemovedPosition() {
		when(presenceRepo.applyLeave(EMAIL, 7L))
				.thenReturn(List.of("20", "2", "3", "4", "7"));

		service.leave(EMAIL, 7L);

		verify(eventBus).publish(new PositionChanged(
				EMAIL, 7L, 2,
				20L, null,
				"3:4", null,
				null, null));
	}

	@Test
	@DisplayName("만료된 사용자를 지우면 퇴장을 알린다")
	void expiredLeavePublishesRemovedPosition() {
		when(presenceRepo.applyLeaveExpired(EMAIL, 1000L))
				.thenReturn(List.of("20", "2", "3", "4", "7"));

		service.leaveExpired(EMAIL, 1000L);

		verify(eventBus).publish(new PositionChanged(
				EMAIL, 7L, 2,
				20L, null,
				"3:4", null,
				null, null));
	}

	@Test
	@DisplayName("지운 사용자가 없으면 퇴장을 알리지 않는다")
	void noRemovedPresenceDoesNotPublishLeave() {
		when(presenceRepo.applyLeave(EMAIL, 7L)).thenReturn(List.of());

		service.leave(EMAIL, 7L);

		verifyNoInteractions(eventBus);
	}
}
