package com.ssafy.backend.realtime.scheduler;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.Ride;
import com.ssafy.backend.realtime.service.presence.PresenceService;
import com.ssafy.backend.realtime.service.ride.RideService;

/** 접속이 없거나 바뀐 뒤에도 남은 따라가기 등록만 정리하는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class PresenceCleanupSchedulerTests {

	private static final String GONE = "gone@test.local";
	private static final String RECONNECTED = "reconnected@test.local";
	private static final String ALIVE = "alive@test.local";
	private static final String CAPTAIN = "captain@test.local";

	@Mock MusicPositionCalculator musicPositionCalculator;
	@Mock PresenceService presenceService;
	@Mock PresenceRedisRepository presenceRedisRepository;
	@Mock RideRedisRepository rideRedisRepository;
	@Mock RideService rideService;

	@InjectMocks PresenceCleanupScheduler scheduler;

	@Test
	@DisplayName("접속이 없거나 접속 번호가 바뀐 탑승만 정리하고 살아 있는 탑승은 건드리지 않는다")
	void sweepsOnlyOrphanRides() {
		when(rideRedisRepository.ridingEmails()).thenReturn(Set.of(GONE, RECONNECTED, ALIVE));
		when(rideRedisRepository.findRide(GONE)).thenReturn(new Ride(CAPTAIN, 3L));
		when(rideRedisRepository.findRide(RECONNECTED)).thenReturn(new Ride(CAPTAIN, 3L));
		when(rideRedisRepository.findRide(ALIVE)).thenReturn(new Ride(CAPTAIN, 3L));
		when(presenceRedisRepository.snapshot(GONE)).thenReturn(null);
		when(presenceRedisRepository.snapshot(RECONNECTED)).thenReturn(new PresenceSnapshot(1L, 0, 0, 0, 4L));
		when(presenceRedisRepository.snapshot(ALIVE)).thenReturn(new PresenceSnapshot(1L, 0, 0, 0, 3L));

		scheduler.sweepOrphanRides();

		verify(rideService).onUserGone(GONE);
		verify(rideService).onUserGone(RECONNECTED);
		verify(rideService, never()).onUserGone(ALIVE);
	}

	@Test
	@DisplayName("한 명 정리가 실패해도 나머지는 계속 정리한다")
	void continuesAfterFailure() {
		when(rideRedisRepository.ridingEmails()).thenReturn(Set.of(GONE, RECONNECTED));
		when(rideRedisRepository.findRide(GONE)).thenReturn(new Ride(CAPTAIN, 3L));
		when(rideRedisRepository.findRide(RECONNECTED)).thenReturn(new Ride(CAPTAIN, 3L));
		when(presenceRedisRepository.snapshot(GONE)).thenReturn(null);
		when(presenceRedisRepository.snapshot(RECONNECTED)).thenReturn(null);
		org.mockito.Mockito.doThrow(new RuntimeException("boom")).when(rideService).onUserGone(GONE);

		scheduler.sweepOrphanRides();

		verify(rideService).onUserGone(RECONNECTED);
	}
}
