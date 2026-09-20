package com.ssafy.backend.realtime.service.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.dto.play.PlaySource;
import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RidePlayback;
import com.ssafy.backend.realtime.dto.ride.RideResponse;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountStatus;
import com.ssafy.backend.realtime.service.play.MusicPlayService;
import com.ssafy.backend.realtime.service.play.MusicPlayService.Placed;

/** 따라가기 시작이 무엇을 어떤 순서로 하는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RideServiceTests {

	private static final String RIDER = "rider@x.com";
	private static final String CAPTAIN = "captain@x.com";

	@Mock RideRedisRepository rideRedisRepository;
	@Mock PresenceRedisRepository presenceRedisRepository;
	@Mock MusicPlayService musicPlayService;
	@Mock RidePlaybackService ridePlaybackService;
	@InjectMocks RideService service;

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
	@DisplayName("자격 확인에 걸리면 곡 위로 옮기지 않는다")
	void rejectedMountDoesNotPlace() {
		givenConnectedRider();
		when(rideRedisRepository.mount(RIDER, CAPTAIN, 5L, 20)).thenReturn(full());

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.RIDE_FULL));

		verifyNoInteractions(musicPlayService, ridePlaybackService);
	}

	@Test
	@DisplayName("거부 사유마다 다른 코드로 내린다")
	void statusMapsToErrorCode() {
		assertErrorCode(MountStatus.ALREADY_RIDING, RealtimeErrorCode.RIDE_ALREADY_RIDING);
		assertErrorCode(MountStatus.CHAIN, RealtimeErrorCode.RIDE_CHAIN_FORBIDDEN);
		assertErrorCode(MountStatus.CAPTAIN_INACTIVE, RealtimeErrorCode.RIDE_CAPTAIN_INACTIVE);
		assertErrorCode(MountStatus.STALE, RealtimeErrorCode.PRESENCE_ERROR);
	}

	@Test
	@DisplayName("인솔자가 서 있는 곡과 레이어로 옮긴다")
	void placesOnCaptainMusicAndLayer() {
		givenConnectedRider();
		when(rideRedisRepository.mount(RIDER, CAPTAIN, 5L, 20)).thenReturn(ok(10877L, 3));
		when(musicPlayService.placeOnMusic(
				anyString(), any(), anyLong(), anyInt(), anyString())).thenReturn(placed());
		when(ridePlaybackService.read(CAPTAIN)).thenReturn(
				new RidePlayback(10877L, PlaybackState.PLAYING, 42_000L, 4L));

		RideResponse response = service.mount(RIDER, CAPTAIN);

		verify(musicPlayService).placeOnMusic(
				RIDER, riderSnapshot(), 10877L, 3, PlaySource.FOLLOW.name());
		assertThat(response.musicId()).isEqualTo(10877L);
		assertThat(response.layer()).isEqualTo(3);
		assertThat(response.positionMs()).isEqualTo(42_000L);
		assertThat(response.snapshotSeq()).isEqualTo(4L);
		assertThat(response.playHistoryId()).isEqualTo(77L);
	}

	/**
	 * 자격 확인과 재생 정보 읽기 사이에 인솔자가 곡을 바꾼 경우다.
	 * 옮겨 놓은 자리가 기준이라 그 곡을 처음부터 튼다 — 자리와 소리가 어긋나면 안 된다.
	 */
	@Test
	@DisplayName("옮긴 곡과 읽어 온 곡이 다르면 옮긴 곡을 처음부터 튼다")
	void differentMusicFallsBackToPlacedMusic() {
		givenConnectedRider();
		when(rideRedisRepository.mount(RIDER, CAPTAIN, 5L, 20)).thenReturn(ok(10877L, 3));
		when(musicPlayService.placeOnMusic(
				anyString(), any(), anyLong(), anyInt(), anyString())).thenReturn(placed());
		when(ridePlaybackService.read(CAPTAIN)).thenReturn(
				new RidePlayback(20999L, PlaybackState.PLAYING, 42_000L, 9L));

		RideResponse response = service.mount(RIDER, CAPTAIN);

		assertThat(response.musicId()).isEqualTo(10877L);
		assertThat(response.positionMs()).isZero();
		assertThat(response.snapshotSeq()).isZero();
	}

	@Test
	@DisplayName("재생 정보를 못 읽어도 옮긴 곡을 처음부터 튼다")
	void missingPlaybackFallsBackToPlacedMusic() {
		givenConnectedRider();
		when(rideRedisRepository.mount(RIDER, CAPTAIN, 5L, 20)).thenReturn(ok(10877L, 3));
		when(musicPlayService.placeOnMusic(
				anyString(), any(), anyLong(), anyInt(), anyString())).thenReturn(placed());
		when(ridePlaybackService.read(CAPTAIN)).thenReturn(null);

		RideResponse response = service.mount(RIDER, CAPTAIN);

		assertThat(response.musicId()).isEqualTo(10877L);
		assertThat(response.playback()).isEqualTo(PlaybackState.PLAYING);
		assertThat(response.positionMs()).isZero();
	}

	private void assertErrorCode(MountStatus status, RealtimeErrorCode expected) {
		when(presenceRedisRepository.snapshot(RIDER)).thenReturn(riderSnapshot());
		when(rideRedisRepository.mount(RIDER, CAPTAIN, 5L, 20))
				.thenReturn(new MountResult(status, 0, 0));

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(expected));
	}

	private void givenConnectedRider() {
		when(presenceRedisRepository.snapshot(RIDER)).thenReturn(riderSnapshot());
	}

	/** 아직 지도에 서 있지 않은 사람. 따라가기가 첫 배치가 되는 경우다. */
	private static PresenceSnapshot riderSnapshot() {
		return new PresenceSnapshot(null, null, null, null, 5L);
	}

	private static MountResult ok(long musicId, int layer) {
		return new MountResult(MountStatus.OK, musicId, layer);
	}

	private static MountResult full() {
		return new MountResult(MountStatus.FULL, 0, 0);
	}

	private static Placed placed() {
		return new Placed(77L, 3, -1.25, 1.2, 7, 5, List.of());
	}
}
