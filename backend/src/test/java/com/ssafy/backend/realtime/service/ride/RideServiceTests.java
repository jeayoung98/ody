package com.ssafy.backend.realtime.service.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.dto.play.PlaySource;
import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RidePlayback;
import com.ssafy.backend.realtime.dto.ride.RideResponse;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountStatus;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.play.MusicPlayService;

/** 따라가기 시작이 무엇을 어떤 순서로 하는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RideServiceTests {

	private static final String RIDER = "rider@x.com";
	private static final String CAPTAIN = "captain@x.com";
	private static final long MUSIC = 10877L;
	private static final int LAYER = 3;

	@Mock RideRedisRepository rideRedisRepository;
	@Mock PresenceRedisRepository presenceRedisRepository;
	@Mock MusicLocationService musicLocationService;
	@Mock MusicPositionCalculator musicPositionCalculator;
	@Mock MusicPlayService musicPlayService;
	@Mock RidePlaybackService ridePlaybackService;
	@Mock RealtimeEventService realtimeEventService;
	@InjectMocks RideService service;

	private final double[] location = location();
	private final Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 7, 5);

	@Test
	@DisplayName("자기 자신은 Redis 를 보지 않고 거부한다")
	void selfIsRejectedWithoutRedis() {
		assertThatThrownBy(() -> service.mount(RIDER, RIDER))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.RIDE_SELF));

		verifyNoInteractions(rideRedisRepository, presenceRedisRepository, musicPlayService);
	}

	@Test
	@DisplayName("접속 정보가 없으면 자격 확인까지 가지 않는다")
	void notConnectedIsRejected() {
		when(presenceRedisRepository.snapshot(RIDER)).thenReturn(null);

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.PRESENCE_ERROR));

		verifyNoInteractions(rideRedisRepository, musicPlayService);
	}

	@Test
	@DisplayName("자격 확인에 걸리면 자리를 옮기지 않는다")
	void rejectedMountDoesNotPlace() {
		when(presenceRedisRepository.snapshot(RIDER)).thenReturn(standingAt(20999L, 1));
		when(rideRedisRepository.mount(RIDER, CAPTAIN, 5L, 20))
				.thenReturn(new MountResult(MountStatus.FULL, 0, 0));

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.RIDE_FULL));

		verifyNoInteractions(musicPlayService, ridePlaybackService, realtimeEventService);
		verify(presenceRedisRepository, never()).applyRidePlacement(
				anyString(), anyLong(), any(), any(), any(), any(),
				anyLong(), anyInt(), anyDouble(), anyDouble(), anyInt(), anyInt());
	}

	@Test
	@DisplayName("거부 사유마다 다른 코드로 내린다")
	void statusMapsToErrorCode() {
		assertErrorCode(MountStatus.ALREADY_RIDING, RealtimeErrorCode.RIDE_ALREADY_RIDING);
		assertErrorCode(MountStatus.CHAIN, RealtimeErrorCode.RIDE_CHAIN_FORBIDDEN);
		assertErrorCode(MountStatus.CAPTAIN_INACTIVE, RealtimeErrorCode.RIDE_CAPTAIN_INACTIVE);
		assertErrorCode(MountStatus.STALE, RealtimeErrorCode.PRESENCE_ERROR);
	}

	/**
	 * 지도 인덱스에 넣으면 그룹이 한 점이 아니게 된다.
	 * 인솔자가 곡을 바꿀 때마다 위치 변경이 인원수만큼 터진다.
	 */
	@Test
	@DisplayName("인솔자 자리로 옮기되 지도에는 넣지 않는다")
	void placesWithoutMapIndex() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(42_000L, 4L);

		RideResponse response = service.mount(RIDER, CAPTAIN);

		verify(presenceRedisRepository).applyRidePlacement(
				RIDER, 5L, 20999L, 1, 2, 2, MUSIC, LAYER, 0.2, 0.7, 7, 5);
		verify(musicPlayService, never())
				.placeOnMusic(anyString(), any(), anyLong(), anyInt(), anyString());
		assertThat(response.musicId()).isEqualTo(MUSIC);
		assertThat(response.layer()).isEqualTo(LAYER);
		assertThat(response.playHistoryId()).isEqualTo(77L);
	}

	@Test
	@DisplayName("재생 기록은 남기되 발견자와 만남은 남기지 않는다")
	void recordsPlayOnly() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(0L, 1L);

		service.mount(RIDER, CAPTAIN);

		verify(musicPlayService).recordPlay(RIDER, MUSIC, PlaySource.FOLLOW.name());
	}

	/** 남들 화면에서 사라져야 한다. 지도에 다시 넣지 않으므로 알림은 이 한 건으로 끝난다. */
	@Test
	@DisplayName("서 있던 자리가 있었으면 사라졌다고 한 번 알린다")
	void notifiesLeaveOnce() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(0L, 1L);

		service.mount(RIDER, CAPTAIN);

		ArgumentCaptor<PositionChanged> captor = ArgumentCaptor.forClass(PositionChanged.class);
		verify(realtimeEventService).send(captor.capture());
		PositionChanged event = captor.getValue();
		assertThat(event.email()).isEqualTo(RIDER);
		assertThat(event.oldMusicId()).isEqualTo(20999L);
		assertThat(event.newMusicId()).isNull();
		assertThat(event.newCell()).isNull();
	}

	@Test
	@DisplayName("아직 지도에 없던 사람은 알릴 것도 없다")
	void firstPlacementNotifiesNothing() {
		givenStanding(null, null);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(0L, 1L);

		service.mount(RIDER, CAPTAIN);

		verifyNoInteractions(realtimeEventService);
	}

	/**
	 * 자격 확인과 재생 정보 읽기 사이에 인솔자가 곡을 바꾼 경우다.
	 * 옮겨 놓은 자리가 기준이라 그 곡을 처음부터 튼다 — 자리와 소리가 어긋나면 안 된다.
	 */
	@Test
	@DisplayName("옮긴 곡과 읽어 온 곡이 다르면 옮긴 곡을 처음부터 튼다")
	void differentMusicFallsBackToPlacedMusic() {
		givenStanding(null, null);
		givenMountOk();
		givenPlacement();
		when(ridePlaybackService.read(CAPTAIN))
				.thenReturn(new RidePlayback(30111L, PlaybackState.PLAYING, 42_000L, 9L));

		RideResponse response = service.mount(RIDER, CAPTAIN);

		assertThat(response.musicId()).isEqualTo(MUSIC);
		assertThat(response.positionMs()).isZero();
		assertThat(response.snapshotSeq()).isZero();
	}

	@Test
	@DisplayName("재생 정보를 못 읽어도 옮긴 곡을 처음부터 튼다")
	void missingPlaybackFallsBackToPlacedMusic() {
		givenStanding(null, null);
		givenMountOk();
		givenPlacement();
		when(ridePlaybackService.read(CAPTAIN)).thenReturn(null);

		RideResponse response = service.mount(RIDER, CAPTAIN);

		assertThat(response.musicId()).isEqualTo(MUSIC);
		assertThat(response.playback()).isEqualTo(PlaybackState.PLAYING);
		assertThat(response.positionMs()).isZero();
	}

	private void assertErrorCode(MountStatus status, RealtimeErrorCode expected) {
		when(presenceRedisRepository.snapshot(RIDER)).thenReturn(standingAt(20999L, 1));
		when(rideRedisRepository.mount(RIDER, CAPTAIN, 5L, 20))
				.thenReturn(new MountResult(status, 0, 0));

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(expected));
	}

	private void givenStanding(Long musicId, Integer layer) {
		when(presenceRedisRepository.snapshot(RIDER)).thenReturn(standingAt(musicId, layer));
	}

	private void givenMountOk() {
		when(rideRedisRepository.mount(RIDER, CAPTAIN, 5L, 20))
				.thenReturn(new MountResult(MountStatus.OK, MUSIC, LAYER));
	}

	private void givenPlacement() {
		when(musicLocationService.findLocation(MUSIC)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, LAYER)).thenReturn(placement);
		when(presenceRedisRepository.applyRidePlacement(
				anyString(), anyLong(), any(), any(), any(), any(),
				anyLong(), anyInt(), anyDouble(), anyDouble(), anyInt(), anyInt())).thenReturn(true);
		when(musicPlayService.recordPlay(anyString(), anyLong(), anyString())).thenReturn(77L);
	}

	private void givenPlaybackAt(long positionMs, long snapshotSeq) {
		when(ridePlaybackService.read(CAPTAIN))
				.thenReturn(new RidePlayback(MUSIC, PlaybackState.PLAYING, positionMs, snapshotSeq));
	}

	/** 지도에 서 있는 상태. musicId 가 null 이면 아직 어디에도 없다. */
	private static PresenceSnapshot standingAt(Long musicId, Integer layer) {
		Integer cell = musicId == null ? null : 2;
		return new PresenceSnapshot(musicId, layer, cell, cell, 5L);
	}

	private static double[] location() {
		double[] pc = new double[16];
		pc[1] = -1.25;
		pc[2] = 1.2;
		return pc;
	}
}
