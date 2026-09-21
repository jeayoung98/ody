package com.ssafy.backend.realtime.service.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RidePlayback;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackEvent;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackPayload;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackRequest;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.PlaybackSnapshot;

/** 그룹이 트는 곡의 지금 위치와, 인솔자 재생 조작 전달을 검증한다. */
@ExtendWith(MockitoExtension.class)
class RidePlaybackServiceTests {

	private static final String CAPTAIN = "captain@x.com";
	private static final String RIDER = "rider@x.com";
	private static final long NOW = 1_700_000_100_000L;

	@Mock RideRedisRepository rideRedisRepository;
	@Mock PresenceRedisRepository presenceRedisRepository;
	@Mock RealtimeMessageService realtimeMessageService;
	@Mock RideGuard rideGuard;

	private final Clock clock = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);

	private RidePlaybackService service() {
		return new RidePlaybackService(
				rideRedisRepository, presenceRedisRepository, clock, rideGuard, realtimeMessageService);
	}

	@Test
	@DisplayName("틀고 있으면 저장된 뒤 흐른 시간을 더한다")
	void playingAddsElapsed() {
		when(rideRedisRepository.findPlayback(CAPTAIN)).thenReturn(
				new PlaybackSnapshot(10877L, PlaybackState.PLAYING, 30_000L, NOW - 12_000L, 4L));

		RidePlayback playback = service().read(CAPTAIN);

		assertThat(playback.positionMs()).isEqualTo(42_000L);
		assertThat(playback.snapshotSeq()).isEqualTo(4L);
	}

	@Test
	@DisplayName("멈춰 있으면 저장된 위치 그대로다")
	void pausedKeepsPosition() {
		when(rideRedisRepository.findPlayback(CAPTAIN)).thenReturn(
				new PlaybackSnapshot(10877L, PlaybackState.PAUSED, 30_000L, NOW - 12_000L, 4L));

		assertThat(service().read(CAPTAIN).positionMs()).isEqualTo(30_000L);
	}

	@Test
	@DisplayName("저장된 게 없으면 서 있는 곡으로 처음부터 만든다")
	void seedsFromPresenceWhenMissing() {
		when(rideRedisRepository.findPlayback(CAPTAIN)).thenReturn(null);
		when(presenceRedisRepository.snapshot(CAPTAIN))
				.thenReturn(new PresenceSnapshot(10877L, 2, 1, 1, 7L));
		when(rideRedisRepository.savePlayback(CAPTAIN, 10877L, PlaybackState.PLAYING, 0L, NOW))
				.thenReturn(1L);

		RidePlayback playback = service().read(CAPTAIN);

		assertThat(playback.musicId()).isEqualTo(10877L);
		assertThat(playback.state()).isEqualTo(PlaybackState.PLAYING);
		assertThat(playback.positionMs()).isZero();
		assertThat(playback.snapshotSeq()).isEqualTo(1L);
	}

	/** 저장하지 않으면 다음 사람도 또 처음부터 듣는다. */
	@Test
	@DisplayName("처음 만든 값은 저장해 둔다")
	void seedIsStored() {
		when(rideRedisRepository.findPlayback(CAPTAIN)).thenReturn(null);
		when(presenceRedisRepository.snapshot(CAPTAIN))
				.thenReturn(new PresenceSnapshot(10877L, 2, 1, 1, 7L));

		service().read(CAPTAIN);

		verify(rideRedisRepository).savePlayback(CAPTAIN, 10877L, PlaybackState.PLAYING, 0L, NOW);
	}

	@Test
	@DisplayName("곡 위에 없으면 아무것도 만들지 않는다")
	void returnsNullWhenCaptainHasNoMusic() {
		when(rideRedisRepository.findPlayback(CAPTAIN)).thenReturn(null);
		when(presenceRedisRepository.snapshot(CAPTAIN))
				.thenReturn(new PresenceSnapshot(null, null, null, null, 7L));

		assertThat(service().read(CAPTAIN)).isNull();
		verify(rideRedisRepository, never())
				.savePlayback(anyString(), anyLong(), any(), anyLong(), anyLong());
	}

	@Test
	@DisplayName("정지는 멈춤 상태로 저장하고 따라오는 사람에게 넘긴다")
	void pauseSavesAndSends() {
		when(rideRedisRepository.findPlayback(CAPTAIN)).thenReturn(
				new PlaybackSnapshot(10877L, PlaybackState.PLAYING, 30_000L, NOW - 2_000L, 4L));
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of(RIDER));

		service().relay(CAPTAIN, new RidePlaybackRequest(RidePlaybackEvent.PAUSE, 32_000L));

		verify(rideRedisRepository)
				.savePlayback(CAPTAIN, 10877L, PlaybackState.PAUSED, 32_000L, NOW);
		verify(realtimeMessageService).sendToUser(RIDER, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_PLAYBACK,
				new RidePlaybackPayload(RidePlaybackEvent.PAUSE, PlaybackState.PAUSED, 32_000L, NOW));
	}

	/** 재생바만 옮긴 것은 위치만 바뀐 일이라, 멈춰 있던 사람이 갑자기 재생되면 안 된다. */
	@Test
	@DisplayName("구간 이동은 멈춤·재생 상태를 그대로 둔다")
	void seekKeepsState() {
		when(rideRedisRepository.findPlayback(CAPTAIN)).thenReturn(
				new PlaybackSnapshot(10877L, PlaybackState.PAUSED, 30_000L, NOW - 2_000L, 4L));
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of());

		service().relay(CAPTAIN, new RidePlaybackRequest(RidePlaybackEvent.SEEK, 5_000L));

		verify(rideRedisRepository)
				.savePlayback(CAPTAIN, 10877L, PlaybackState.PAUSED, 5_000L, NOW);
	}

	@Test
	@DisplayName("따라오는 사람이 없으면 저장만 하고 보내지 않는다")
	void noRidersSkipsSend() {
		when(rideRedisRepository.findPlayback(CAPTAIN)).thenReturn(
				new PlaybackSnapshot(10877L, PlaybackState.PLAYING, 30_000L, NOW - 2_000L, 4L));
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of());

		service().relay(CAPTAIN, new RidePlaybackRequest(RidePlaybackEvent.PLAY, 30_000L));

		verify(rideRedisRepository)
				.savePlayback(CAPTAIN, 10877L, PlaybackState.PLAYING, 30_000L, NOW);
		verifyNoInteractions(realtimeMessageService);
	}

	@Test
	@DisplayName("따라가는 중인 사람이 보내면 거부한다")
	void riderCannotControl() {
		org.mockito.Mockito.doThrow(new WebSocketRequestException(
				WebSocketErrorCode.RIDE_NOT_CAPTAIN, "따라가는 중에는 재생 조작을 보낼 수 없다"))
				.when(rideGuard).requireNotRiding(anyString(), anyString());

		assertThatThrownBy(() ->
				service().relay(RIDER, new RidePlaybackRequest(RidePlaybackEvent.PAUSE, 1_000L)))
				.isInstanceOf(WebSocketRequestException.class)
				.extracting(e -> ((WebSocketRequestException) e).getCode())
				.isEqualTo(WebSocketErrorCode.RIDE_NOT_CAPTAIN);

		verify(rideRedisRepository, never())
				.savePlayback(anyString(), anyLong(), any(), anyLong(), anyLong());
	}

	@Test
	@DisplayName("모르는 조작 종류는 거부한다")
	void unknownEventRejected() {
		assertThatThrownBy(() -> service().relay(CAPTAIN, new RidePlaybackRequest(null, 1_000L)))
				.isInstanceOf(IllegalArgumentException.class);

		verifyNoInteractions(realtimeMessageService);
	}
}
