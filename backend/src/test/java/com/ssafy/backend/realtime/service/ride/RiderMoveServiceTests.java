package com.ssafy.backend.realtime.service.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ssafy.backend.realtime.dto.play.PlayHistoryRow;
import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RideTrackPayload;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.repository.mapper.PlayHistoryMapper;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.service.music.MusicLocationService;

/** 인솔자가 곡을 바꿨을 때 따라오는 사람들이 같이 움직이는지 확인한다. */
class RiderMoveServiceTests {

	private static final long NOW = 1789720100000L;
	private static final String CAPTAIN = "captain@example.com";
	private static final long MUSIC_ID = 4927L;
	private static final int LAYER = 3;
	private static final double RAW_X = -1.2542783;
	private static final double RAW_Y = 1.2062433;

	private final RideRedisRepository rideRedisRepository = mock(RideRedisRepository.class);
	private final PresenceRedisRepository presenceRedisRepository = mock(PresenceRedisRepository.class);
	private final MusicLocationService musicLocationService = mock(MusicLocationService.class);
	private final PlayHistoryMapper playHistoryMapper = mock(PlayHistoryMapper.class);
	private final RealtimeMessageService realtimeMessageService = mock(RealtimeMessageService.class);

	private final Placement placement = new Placement(LAYER, 5, 6, 0.4, 0.6, 7, 9);

	private RiderMoveService riderMoveService;

	@BeforeEach
	void setUp() {
		riderMoveService = new RiderMoveService(
				rideRedisRepository, presenceRedisRepository, musicLocationService,
				playHistoryMapper, realtimeMessageService,
				Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC));
		given(musicLocationService.playable(anyLong())).willReturn(true);
	}

	/** 따라오는 사람 이름을 만들고, 접속 상태와 기록 번호까지 준비한다. */
	private List<String> givenRiders(int count) {
		List<String> riders = new ArrayList<>();
		for (int i = 0; i < count; i++) {
			String rider = "rider" + i + "@example.com";
			riders.add(rider);
			given(presenceRedisRepository.snapshot(rider))
					.willReturn(new PresenceSnapshot(1000L, LAYER, 1, 2, 77L));
		}
		given(presenceRedisRepository.applyRidePlacement(
				anyString(), anyLong(), any(), any(), any(), any(),
				anyLong(), anyInt(), anyDouble(), anyDouble(), anyInt(), anyInt()))
				.willReturn(true);
		givenIds(count + 1);
		return riders;
	}

	private void givenIds(int count) {
		List<Long> ids = new ArrayList<>();
		for (int i = 0; i < count; i++) {
			ids.add(9000L + i);
		}
		given(playHistoryMapper.nextIds(count)).willReturn(ids);
	}

	private long moveAll(List<String> riders) {
		return riderMoveService.moveAll(
				CAPTAIN, riders, MUSIC_ID, LAYER, placement, RAW_X, RAW_Y, "MAP");
	}

	@Test
	@DisplayName("따라오는 사람이 없으면 빈 목록을 준다")
	void noRiders() {
		given(rideRedisRepository.riders(CAPTAIN)).willReturn(Set.of());

		assertThat(riderMoveService.ridersOf(CAPTAIN)).isEmpty();
	}

	@Test
	@DisplayName("따라오는 사람 목록을 그대로 준다")
	void listsRiders() {
		given(rideRedisRepository.riders(CAPTAIN))
				.willReturn(new LinkedHashSet<>(List.of("a@example.com", "b@example.com")));

		assertThat(riderMoveService.ridersOf(CAPTAIN))
				.containsExactlyInAnyOrder("a@example.com", "b@example.com");
	}

	@Test
	@DisplayName("20명이 따라오면 기록은 21줄이 한 번에, 재생수는 한 번에 21 올라간다")
	void writesOneBatchForTwentyRiders() {
		List<String> riders = givenRiders(20);

		moveAll(riders);

		ArgumentCaptor<List<PlayHistoryRow>> rows = ArgumentCaptor.forClass(List.class);
		verify(playHistoryMapper, times(1)).insertBatch(rows.capture());
		assertThat(rows.getValue()).hasSize(21);
		verify(playHistoryMapper, times(1)).incrementPlayCntBy(MUSIC_ID, 21);
		// 한 줄씩 넣는 옛 경로는 쓰지 않는다
		verify(playHistoryMapper, never()).insert(any());
		verify(playHistoryMapper, never()).incrementPlayCnt(anyLong());
	}

	@Test
	@DisplayName("인솔자가 기록의 맨 앞이고 그 번호를 돌려준다")
	void returnsCaptainPlayHistoryId() {
		List<String> riders = givenRiders(3);

		long playHistoryId = moveAll(riders);

		ArgumentCaptor<List<PlayHistoryRow>> rows = ArgumentCaptor.forClass(List.class);
		verify(playHistoryMapper).insertBatch(rows.capture());
		assertThat(rows.getValue().get(0).getEmail()).isEqualTo(CAPTAIN);
		assertThat(playHistoryId).isEqualTo(rows.getValue().get(0).getId());
	}

	@Test
	@DisplayName("옮기지 못한 사람은 기록에도 알림에도 들어가지 않는다")
	void skipsRiderThatCouldNotMove() {
		List<String> riders = givenRiders(3);
		// 두 번째 사람만 접속이 끊겨 있다
		given(presenceRedisRepository.snapshot(riders.get(1))).willReturn(null);
		givenIds(3);

		moveAll(riders);

		ArgumentCaptor<List<PlayHistoryRow>> rows = ArgumentCaptor.forClass(List.class);
		verify(playHistoryMapper).insertBatch(rows.capture());
		assertThat(rows.getValue()).hasSize(3);
		assertThat(rows.getValue()).extracting(PlayHistoryRow::getEmail)
				.doesNotContain(riders.get(1));
		verify(realtimeMessageService, never()).sendToUser(
				eq(riders.get(1)), anyString(), any(), any());
	}

	@Test
	@DisplayName("새 곡으로 바꾸면서 위치는 0, 시작 시각은 지금으로 적는다")
	void savesNewTrackFromTheStart() {
		List<String> riders = givenRiders(2);

		moveAll(riders);

		verify(rideRedisRepository).savePlayback(CAPTAIN, MUSIC_ID, PlaybackState.PLAYING, 0L, NOW);
	}

	@Test
	@DisplayName("따라오는 사람마다 새 곡을 알리고 좌표는 지도와 같은 값을 보낸다")
	void sendsTrackToEveryRider() {
		List<String> riders = givenRiders(2);

		moveAll(riders);

		ArgumentCaptor<RideTrackPayload> payload = ArgumentCaptor.forClass(RideTrackPayload.class);
		verify(realtimeMessageService, times(2)).sendToUser(
				anyString(), anyString(), eq(RealtimeMessageType.RIDE_TRACK), payload.capture());
		RideTrackPayload sent = payload.getValue();
		assertThat(sent.musicId()).isEqualTo(MUSIC_ID);
		assertThat(sent.layer()).isEqualTo(LAYER);
		assertThat(sent.x()).isEqualTo(RAW_X);
		assertThat(sent.y()).isEqualTo(RAW_Y);
		assertThat(sent.serverTs()).isEqualTo(NOW);
		assertThat(sent.playable()).isTrue();
	}

	@Test
	@DisplayName("소리를 틀 수 없는 곡은 한 번만 확인해 모두에게 같은 값을 보낸다")
	void checksPlayableOnce() {
		List<String> riders = givenRiders(5);
		given(musicLocationService.playable(MUSIC_ID)).willReturn(false);

		moveAll(riders);

		verify(musicLocationService, times(1)).playable(MUSIC_ID);
		ArgumentCaptor<RideTrackPayload> payload = ArgumentCaptor.forClass(RideTrackPayload.class);
		verify(realtimeMessageService, times(5)).sendToUser(
				anyString(), anyString(), eq(RealtimeMessageType.RIDE_TRACK), payload.capture());
		assertThat(payload.getAllValues()).allMatch(p -> !p.playable());
	}

	// ── 인솔자가 층만 옮겼을 때 ─────────────────────────────

	/** 곡은 그대로다. 기록도 재생 정보도 곡 알림도 없어야 한다. */
	@Test
	@DisplayName("층만 옮기면 자리만 맞추고 기록은 남기지 않는다")
	void layerMoveOnlyRepositions() {
		List<String> riders = givenRiders(2);
		given(rideRedisRepository.riders(CAPTAIN)).willReturn(new LinkedHashSet<>(riders));

		assertThat(riderMoveService.moveToLayer(CAPTAIN, MUSIC_ID, LAYER, placement)).isEqualTo(2);

		verify(presenceRedisRepository, times(2)).applyRidePlacement(
				anyString(), anyLong(), any(), any(), any(), any(),
				eq(MUSIC_ID), eq(LAYER), anyDouble(), anyDouble(), anyInt(), anyInt());
		verifyNoInteractions(playHistoryMapper, realtimeMessageService);
		verify(rideRedisRepository, never()).savePlayback(
				anyString(), anyLong(), any(), anyLong(), anyLong());
	}

	@Test
	@DisplayName("따라오는 사람이 없으면 아무것도 하지 않는다")
	void layerMoveWithoutRidersDoesNothing() {
		given(rideRedisRepository.riders(CAPTAIN)).willReturn(Set.of());

		assertThat(riderMoveService.moveToLayer(CAPTAIN, MUSIC_ID, LAYER, placement)).isZero();

		verifyNoInteractions(presenceRedisRepository, playHistoryMapper, realtimeMessageService);
	}

	/** 사람은 이미 Redis 에서 옮겨졌다. 기록이 터져도 듣는 곡만큼은 맞아야 한다. */
	@Test
	@DisplayName("기록이 실패해도 새 곡은 이미 알린 뒤다")
	void trackIsSentBeforeHistory() {
		List<String> riders = givenRiders(1);
		given(playHistoryMapper.nextIds(2)).willThrow(new IllegalStateException("기록 실패"));

		try {
			moveAll(riders);
		} catch (IllegalStateException ignored) {
			// 기록 실패는 그대로 올라간다
		}

		verify(rideRedisRepository).savePlayback(
				eq(CAPTAIN), eq(MUSIC_ID), eq(PlaybackState.PLAYING), eq(0L), anyLong());
		verify(realtimeMessageService).sendToUser(
				eq(riders.get(0)), anyString(), eq(RealtimeMessageType.RIDE_TRACK), any());
	}
}
