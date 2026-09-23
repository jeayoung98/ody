package com.ssafy.backend.realtime.service.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;

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
import com.ssafy.backend.realtime.dto.ride.RidePanelPayload;
import com.ssafy.backend.realtime.dto.ride.RidePanelTab;
import com.ssafy.backend.realtime.dto.ride.RidePlayback;
import com.ssafy.backend.realtime.dto.ride.DisbandResponse;
import com.ssafy.backend.realtime.dto.ride.RideEndReason;
import com.ssafy.backend.realtime.dto.ride.RideEndedPayload;
import com.ssafy.backend.realtime.dto.ride.RideResponse;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.dto.ride.DismountResponse;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.dto.ride.RideRiderJoinedPayload;
import com.ssafy.backend.realtime.dto.ride.RideRiderLeftPayload;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DisbandResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DismountResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.DismountStatus;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.Ride;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.RiderLeaveResult;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.service.meeting.MeetingService;
import com.ssafy.backend.realtime.service.nearby.NearbyChangeService;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountResult;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.MountStatus;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.PanelSnapshot;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.play.MusicPlayService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;
import com.ssafy.backend.realtime.service.viewport.ViewportDeltaService;

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
	@Mock RideSubscriptionService rideSubscriptionService;
	@Mock RideViewportService rideViewportService;
	@Mock RideViewService rideViewService;
	@Mock RealtimeEventService realtimeEventService;
	@Mock RealtimeMessageService realtimeMessageService;
	@Mock MeetingService meetingService;
	@Mock ViewportDeltaService viewportDeltaService;
	@Mock NearbyChangeService nearbyChangeService;
	@Mock UserDisplayService userDisplayService;
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
		// 읽은 뒤에 접속 번호가 바뀐 것이다. 접속이 없는 것과 달리 새로 고치면 풀린다.
		assertErrorCode(MountStatus.STALE, RealtimeErrorCode.RIDE_STALE);
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

	/**
	 * 인솔자가 인원수를 아는 길이 이것뿐이다.
	 * 남들 화면에 나가는 인원수 알림은 인솔자 자리를 보는 사람들에게 가는 것이라 본인은 빠진다.
	 */
	@Test
	@DisplayName("탈 때 인솔자에게 누가 탔는지 알린다")
	void mountTellsCaptainWhoJoined() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(0L, 1L);
		when(rideRedisRepository.riderCount(CAPTAIN)).thenReturn(3);
		when(userDisplayService.find(RIDER)).thenReturn(new UserDisplay("연희", null));

		service.mount(RIDER, CAPTAIN);

		verify(realtimeMessageService).sendToUser(
				eq(CAPTAIN), eq(WebSocketDestination.QUEUE_PRESENCE),
				eq(RealtimeMessageType.RIDE_RIDER_JOINED),
				eq(new RideRiderJoinedPayload(RIDER, "연희", 3)));
	}

	/** 이름이 없는 사람도 탈 수 있다. 여기서 터지면 탑승 자체가 되돌려진다. */
	@Test
	@DisplayName("이름이 없어도 탑승 알림은 나간다")
	void mountTellsCaptainEvenWithoutNickname() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(0L, 1L);
		when(rideRedisRepository.riderCount(CAPTAIN)).thenReturn(1);
		when(userDisplayService.find(RIDER)).thenReturn(new UserDisplay(null, null));

		service.mount(RIDER, CAPTAIN);

		verify(realtimeMessageService).sendToUser(
				eq(CAPTAIN), anyString(), eq(RealtimeMessageType.RIDE_RIDER_JOINED),
				eq(new RideRiderJoinedPayload(RIDER, null, 1)));
	}

	/**
	 * 알림이 실패해도 탑승은 이미 끝나 있다.
	 * 여기서 예외가 올라가면 되돌리기가 돌아 멀쩡한 탑승이 취소된다.
	 */
	@Test
	@DisplayName("탑승 알림이 실패해도 따라가기는 성립한다")
	void mountSurvivesFailedJoinNotice() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(0L, 1L);
		when(rideRedisRepository.riderCount(CAPTAIN)).thenReturn(1);
		when(userDisplayService.find(RIDER)).thenThrow(new IllegalStateException("이름 조회 실패"));

		RideResponse response = service.mount(RIDER, CAPTAIN);

		assertThat(response.captainEmail()).isEqualTo(CAPTAIN);
		verify(rideRedisRepository, never()).dismount(anyString(), anyString());
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

	/** 안 끊으면 인솔자 동네 위에 자기 옛 동네 사람들이 겹쳐 뜬다. */
	@Test
	@DisplayName("혼자 보던 화면과 주변사람 구독을 끊는다")
	void closesOwnViews() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(42_000L, 4L);

		service.mount(RIDER, CAPTAIN);

		verify(rideSubscriptionService).closeOwnViews(RIDER, 5L);
	}

	@Test
	@DisplayName("자격 확인에 걸리면 구독을 끊지 않는다")
	void rejectedMountKeepsOwnViews() {
		when(presenceRedisRepository.snapshot(RIDER)).thenReturn(standingAt(20999L, 1));
		when(rideRedisRepository.mount(RIDER, CAPTAIN, 5L, 20))
				.thenReturn(new MountResult(MountStatus.FULL, 0, 0));

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOf(CustomException.class);

		verifyNoInteractions(rideSubscriptionService);
	}

	/** 중간에 탄 사람은 열린 순간의 알림을 못 받았다. 여기서 안 주면 혼자 빈 화면을 본다. */
	@Test
	@DisplayName("인솔자가 열어 둔 곡 상세를 응답에 같이 준다")
	void answersWithOpenPanel() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(42_000L, 4L);
		when(rideRedisRepository.findPanel(CAPTAIN))
				.thenReturn(new PanelSnapshot(4927L, RidePanelTab.INFO));

		RideResponse response = service.mount(RIDER, CAPTAIN);

		assertThat(response.panel())
				.isEqualTo(RidePanelPayload.opened(4927L, RidePanelTab.INFO));
	}

	@Test
	@DisplayName("열어 둔 곡 상세가 없으면 닫힌 상태로 준다")
	void answersWithClosedPanel() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(42_000L, 4L);
		when(rideRedisRepository.findPanel(CAPTAIN)).thenReturn(null);

		RideResponse response = service.mount(RIDER, CAPTAIN);

		assertThat(response.panel()).isEqualTo(RidePanelPayload.closed());
	}

	/** 안 보내면 인솔자가 지도를 다시 움직일 때까지 빈 화면이다. */
	@Test
	@DisplayName("탑승하면 인솔자가 보고 있는 화면을 한 번 보낸다")
	void sendsCaptainScreenOnMount() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		givenPlaybackAt(42_000L, 4L);

		service.mount(RIDER, CAPTAIN);

		verify(rideViewportService).sendCurrentScreen(RIDER, CAPTAIN);
	}

	@Test
	@DisplayName("자격 확인에 걸리면 화면도 보내지 않는다")
	void rejectedMountSendsNoScreen() {
		when(presenceRedisRepository.snapshot(RIDER)).thenReturn(standingAt(20999L, 1));
		when(rideRedisRepository.mount(RIDER, CAPTAIN, 5L, 20))
				.thenReturn(new MountResult(MountStatus.FULL, 0, 0));

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOf(CustomException.class);

		verifyNoInteractions(rideViewportService);
	}

	// ── 탑승이 뒤에서 실패하면 되돌린다 ───────────────────

	/** 아직 지도에 서 있다. 지도 복귀까지 하면 그 자리 인원수가 하나 늘어난 채 남는다. */
	@Test
	@DisplayName("자리를 옮기기 전에 터지면 등록만 지운다")
	void failureBeforePlacementRemovesRegistrationOnly() {
		givenStanding(20999L, 1);
		givenMountOk();
		when(musicLocationService.findLocation(MUSIC)).thenReturn(Optional.empty());
		when(musicLocationService.exists(MUSIC)).thenReturn(false);

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOf(CustomException.class);

		verify(rideRedisRepository).riderLeave(RIDER);
		verify(rideRedisRepository, never()).dismount(anyString(), anyString());
	}

	/** 이미 지도에서 빠져 있다. 등록만 지우면 어디에도 없는 사람이 된다. */
	@Test
	@DisplayName("자리를 옮긴 뒤에 터지면 지도에 다시 넣는다")
	void failureAfterPlacementPutsBackOnMap() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		when(musicPlayService.recordPlay(anyString(), anyLong(), anyString()))
				.thenThrow(new IllegalStateException("기록 실패"));

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOf(IllegalStateException.class);

		verify(rideRedisRepository).dismount(RIDER, CAPTAIN);
		verify(rideRedisRepository, never()).riderLeave(anyString());
	}

	@Test
	@DisplayName("자리 옮기기가 거부되면 등록만 지운다")
	void rejectedPlacementRemovesRegistrationOnly() {
		givenStanding(20999L, 1);
		givenMountOk();
		when(musicLocationService.findLocation(MUSIC)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, LAYER)).thenReturn(placement);
		when(presenceRedisRepository.applyRidePlacement(
				anyString(), anyLong(), any(), any(), any(), any(),
				anyLong(), anyInt(), anyDouble(), anyDouble(), anyInt(), anyInt())).thenReturn(false);

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOf(CustomException.class);

		verify(rideRedisRepository).riderLeave(RIDER);
	}

	/** 되돌리기까지 실패해도 원래 오류를 그대로 올려야 원인을 알 수 있다. */
	@Test
	@DisplayName("되돌리기가 실패해도 원래 오류를 올린다")
	void undoFailureKeepsOriginalError() {
		givenStanding(20999L, 1);
		givenMountOk();
		givenPlacement();
		when(musicPlayService.recordPlay(anyString(), anyLong(), anyString()))
				.thenThrow(new IllegalStateException("기록 실패"));
		when(rideRedisRepository.dismount(RIDER, CAPTAIN))
				.thenThrow(new IllegalStateException("되돌리기도 실패"));

		assertThatThrownBy(() -> service.mount(RIDER, CAPTAIN))
				.isInstanceOf(IllegalStateException.class)
				.hasMessage("기록 실패");
	}

	// ── 하차 ───────────────────────────────────────────────

	private void givenRiding() {
		when(rideRedisRepository.findRide(RIDER)).thenReturn(new Ride(CAPTAIN, 5L));
		when(presenceRedisRepository.snapshot(RIDER)).thenReturn(standingAt(MUSIC, LAYER));
	}

	/** 남은 동료 명단. 수만 맞으면 되는 자리에 쓴다. */
	private static List<String> mates(int count) {
		List<String> mates = new java.util.ArrayList<>();
		for (int i = 0; i < count; i++) {
			mates.add("mate" + i + "@x.com");
		}
		return mates;
	}

	private void givenDismountOk(int remaining) {
		when(rideRedisRepository.dismount(RIDER, CAPTAIN))
				.thenReturn(new DismountResult(DismountStatus.OK, MUSIC, LAYER, 7, 5,
						mates(remaining), List.of()));
		when(musicLocationService.findLocation(MUSIC)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, LAYER)).thenReturn(placement);
	}

	@Test
	@DisplayName("따라가는 중이 아니면 내릴 것도 없다")
	void notRidingIsRejected() {
		when(rideRedisRepository.findRide(RIDER)).thenReturn(null);

		assertThatThrownBy(() -> service.dismount(RIDER))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.RIDE_NOT_RIDING));

		verify(rideRedisRepository, never()).dismount(anyString(), anyString());
	}

	@Test
	@DisplayName("내리면 인솔자가 마지막으로 있던 자리를 돌려준다")
	void dismountAnswersWithSpot() {
		givenRiding();
		givenDismountOk(2);

		DismountResponse response = service.dismount(RIDER);

		assertThat(response.musicId()).isEqualTo(MUSIC);
		assertThat(response.layer()).isEqualTo(LAYER);
		assertThat(response.cellX()).isEqualTo(7);
		assertThat(response.cellY()).isEqualTo(5);
	}

	/** 따라가는 동안 지도에 없었으니 이전 자리가 있으면 안 된다. */
	@Test
	@DisplayName("지도에 새로 나타났다고 알린다")
	void notifiesEnteredMap() {
		givenRiding();
		givenDismountOk(2);

		service.dismount(RIDER);

		ArgumentCaptor<PositionChanged> captor = ArgumentCaptor.forClass(PositionChanged.class);
		verify(realtimeEventService).send(captor.capture());
		PositionChanged event = captor.getValue();
		assertThat(event.oldMusicId()).isNull();
		assertThat(event.oldLayer()).isNull();
		assertThat(event.oldCell()).isNull();
		assertThat(event.newMusicId()).isEqualTo(MUSIC);
		assertThat(event.newCell()).isEqualTo("7:5");
	}

	@Test
	@DisplayName("인솔자에게 누가 내렸는지와 남은 인원을 알린다")
	void notifiesCaptain() {
		givenRiding();
		givenDismountOk(3);

		service.dismount(RIDER);

		verify(realtimeMessageService).sendToUser(CAPTAIN, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_RIDER_LEFT, new RideRiderLeftPayload(RIDER, 3));
	}

	/** 재생 명령을 보내면 듣던 곡이 끊긴다. 기록을 또 남기면 같은 곡이 두 번 쌓인다. */
	@Test
	@DisplayName("재생 명령도 재생 기록도 만들지 않는다")
	void dismountTouchesNeitherPlaybackNorHistory() {
		givenRiding();
		givenDismountOk(0);

		service.dismount(RIDER);

		verifyNoInteractions(musicPlayService, ridePlaybackService);
		verify(realtimeMessageService, never()).sendToUser(
				anyString(), anyString(), eq(RealtimeMessageType.RIDE_PLAYBACK), any());
		verify(realtimeMessageService, never()).sendToUser(
				anyString(), anyString(), eq(RealtimeMessageType.RIDE_TRACK), any());
	}

	@Test
	@DisplayName("그 사이에 상태가 바뀌었으면 알리지 않는다")
	void staleDismountNotifiesNobody() {
		givenRiding();
		when(rideRedisRepository.dismount(RIDER, CAPTAIN))
				.thenReturn(new DismountResult(DismountStatus.STALE, 0, 0, 0, 0, List.of(), List.of()));

		assertThatThrownBy(() -> service.dismount(RIDER))
				.isInstanceOf(CustomException.class);

		verifyNoInteractions(realtimeEventService, realtimeMessageService);
	}

	/** 내리는 순간 보통 사용자가 되므로 그 곡에 원래 있던 사람과는 만남이 성립한다. */
	@Test
	@DisplayName("내리면 그 곡에 있던 사람들과 만남을 센다")
	void dismountRecordsMeetings() {
		String mate = "mate@example.com";
		String outsider = "outsider@example.com";
		givenRiding();
		when(rideRedisRepository.dismount(RIDER, CAPTAIN))
				.thenReturn(new DismountResult(DismountStatus.OK, MUSIC, LAYER, 7, 5,
						List.of(mate), List.of(CAPTAIN, outsider)));
		when(musicLocationService.findLocation(MUSIC)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, LAYER)).thenReturn(placement);

		service.dismount(RIDER);

		// 선단은 내리기 전에 찍어야 한다. 내린 뒤에 읽으면 본인이 빠져 있다.
		verify(meetingService).recordOnDismount(
				List.of(RIDER), List.of(CAPTAIN, outsider), Set.of(CAPTAIN, RIDER, mate));
	}

	@Test
	@DisplayName("내릴 것이 없으면 만남도 세지 않는다")
	void rejectedDismountRecordsNothing() {
		when(rideRedisRepository.findRide(RIDER)).thenReturn(null);

		assertThatThrownBy(() -> service.dismount(RIDER))
				.isInstanceOf(CustomException.class);

		verifyNoInteractions(meetingService);
	}

	// ── 따라오는 인원수를 남들에게 알린다 ───────────────────

	/** 남들 화면에서 선단은 한 점이라, 이 숫자가 선단임을 아는 유일한 표시다. */
	@Test
	@DisplayName("내리면 인솔자를 보는 사람들에게 줄어든 인원수를 알린다")
	void dismountPushesRiderCount() {
		givenRiding();
		givenDismountOk(2);
		when(presenceRedisRepository.snapshot(CAPTAIN))
				.thenReturn(new PresenceSnapshot(MUSIC, LAYER, 7, 5, 9L));

		service.dismount(RIDER);

		verify(viewportDeltaService).sendRiderCount(CAPTAIN, LAYER, MUSIC, "7:5", 2);
		verify(nearbyChangeService).sendRiderCount(CAPTAIN, LAYER, MUSIC, 2);
	}

	/** 인솔자가 지도에 없으면 보여 줄 자리가 없다. */
	@Test
	@DisplayName("인솔자가 지도에 없으면 인원수를 알리지 않는다")
	void riderCountIsNotPushedWithoutCaptainSpot() {
		givenRiding();
		givenDismountOk(2);
		when(presenceRedisRepository.snapshot(CAPTAIN))
				.thenReturn(new PresenceSnapshot(null, null, null, null, 9L));

		service.dismount(RIDER);

		verify(viewportDeltaService, never()).sendRiderCount(
				anyString(), anyInt(), anyLong(), anyString(), anyInt());
		verify(nearbyChangeService, never()).sendRiderCount(anyString(), anyInt(), anyLong(), anyInt());
	}

	// ── 선단 해체 ───────────────────────────────────────────

	private static final String MATE = "mate@x.com";
	private static final String OUTSIDER = "outsider@x.com";

	private void givenDisbandOk() {
		when(rideRedisRepository.disband(CAPTAIN)).thenReturn(new DisbandResult(
				true, MUSIC, LAYER, 7, 5,
				List.of(RIDER, MATE), List.of(RIDER, MATE), List.of(CAPTAIN, OUTSIDER)));
		when(musicLocationService.findLocation(MUSIC)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, LAYER)).thenReturn(placement);
	}

	@Test
	@DisplayName("해체하면 따라가던 사람 전원에게 끝났다고 알린다")
	void disbandTellsEveryRider() {
		givenDisbandOk();

		service.disband(CAPTAIN, RideEndReason.CAPTAIN_LEFT);

		verify(realtimeMessageService).sendToUser(eq(RIDER), anyString(),
				eq(RealtimeMessageType.RIDE_ENDED), any());
		verify(realtimeMessageService).sendToUser(eq(MATE), anyString(),
				eq(RealtimeMessageType.RIDE_ENDED), any());
	}

	/** 한 명씩 보내면 받는 쪽이 그 수만큼 다시 그리고 중간 상태가 화면에 보인다. */
	@Test
	@DisplayName("남들 화면에는 한 덩어리로 한 번만 알린다")
	void disbandSendsOneBulkMessage() {
		givenDisbandOk();

		service.disband(CAPTAIN, RideEndReason.CAPTAIN_LEFT);

		verify(viewportDeltaService).sendBulkEnter(List.of(RIDER, MATE), LAYER, MUSIC, "7:5");
	}

	/** 선단은 흩기 전에 찍어야 한다. 흩고 나면 ride:riders 가 비어 있다. */
	@Test
	@DisplayName("만남은 선단을 뺀 사람들과만 센다")
	void disbandRecordsMeetingsWithoutFleet() {
		givenDisbandOk();

		service.disband(CAPTAIN, RideEndReason.CAPTAIN_LEFT);

		verify(meetingService).recordOnDismount(
				List.of(RIDER, MATE), List.of(CAPTAIN, OUTSIDER), Set.of(CAPTAIN, RIDER, MATE));
	}

	/** 지도에 못 돌아간 사람도 따라가기가 끝난 것은 마찬가지다. */
	/** 해체는 위치 변경 알림을 거치지 않아, 주변사람 목록은 이걸 안 보내면 끝내 안 바뀐다. */
	@Test
	@DisplayName("해체를 주변사람 목록에도 알린다")
	void disbandTellsNearbyPanels() {
		givenDisbandOk();

		service.disband(CAPTAIN, RideEndReason.CAPTAIN_LEFT);

		verify(nearbyChangeService).sendEnteredTogether(List.of(RIDER, MATE), LAYER, MUSIC);
	}

	/** 여기까지 왔으면 Redis 는 이미 바뀐 뒤다. 하나가 터졌다고 나머지를 건너뛰면 안 된다. */
	@Test
	@DisplayName("알림 하나가 터져도 나머지는 나간다")
	void oneFailedNotificationDoesNotStopTheRest() {
		givenDisbandOk();
		doThrow(new IllegalStateException("화면 알림 실패"))
				.when(viewportDeltaService).sendBulkEnter(any(), anyInt(), anyLong(), anyString());

		service.disband(CAPTAIN, RideEndReason.CAPTAIN_LEFT);

		verify(nearbyChangeService).sendEnteredTogether(List.of(RIDER, MATE), LAYER, MUSIC);
		verify(meetingService).recordOnDismount(any(), any(), any());
	}

	@Test
	@DisplayName("지도에 못 돌아간 사람에게도 끝났다고 알린다")
	void disbandTellsRidersWithoutSpot() {
		// MATE 는 서 있는 자리가 없어 지도에 못 돌아갔다.
		when(rideRedisRepository.disband(CAPTAIN)).thenReturn(new DisbandResult(
				true, MUSIC, LAYER, 7, 5,
				List.of(RIDER, MATE), List.of(RIDER), List.of(OUTSIDER)));
		when(musicLocationService.findLocation(MUSIC)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, LAYER)).thenReturn(placement);

		service.disband(CAPTAIN, RideEndReason.CAPTAIN_LEFT);

		verify(realtimeMessageService).sendToUser(eq(MATE), anyString(),
				eq(RealtimeMessageType.RIDE_ENDED), any());
		// 남들 화면과 만남에는 실제로 돌아간 사람만 넣는다.
		verify(viewportDeltaService).sendBulkEnter(List.of(RIDER), LAYER, MUSIC, "7:5");
	}

	/** 자리를 못 찾으면 어디에 남았다고 할 수가 없다. 등록은 이미 지워졌다. */
	@Test
	@DisplayName("돌아갈 자리를 못 찾으면 알리지 않는다")
	void disbandWithoutSpotNotifiesNobody() {
		when(rideRedisRepository.disband(CAPTAIN)).thenReturn(new DisbandResult(
				true, 0, 0, 0, 0, List.of(RIDER), List.of(), List.of()));

		service.disband(CAPTAIN, RideEndReason.CAPTAIN_LEFT);

		verifyNoInteractions(realtimeMessageService, viewportDeltaService,
				nearbyChangeService, meetingService);
	}

	@Test
	@DisplayName("따라오던 사람이 없으면 아무에게도 알리지 않는다")
	void disbandWithoutRidersNotifiesNobody() {
		when(rideRedisRepository.disband(CAPTAIN))
				.thenReturn(new DisbandResult(false, 0, 0, 0, 0, List.of(), List.of(), List.of()));

		service.disband(CAPTAIN, RideEndReason.CAPTAIN_LEFT);

		verifyNoInteractions(realtimeMessageService, viewportDeltaService,
				nearbyChangeService, meetingService);
	}

	// ── 따라가던 사람이 사라짐 ─────────────────────────────

	/** 스스로 내린 것이 아니라 사라진 것이라 지도에 넣으면 유령이 된다. */
	@Test
	@DisplayName("따라가던 사람이 사라지면 인솔자에게 알리고 지도에는 넣지 않는다")
	void goneRiderIsRemovedWithoutReturningToMap() {
		when(rideRedisRepository.disband(RIDER))
				.thenReturn(new DisbandResult(false, 0, 0, 0, 0, List.of(), List.of(), List.of()));
		when(rideRedisRepository.riderLeave(RIDER)).thenReturn(new RiderLeaveResult(CAPTAIN, 1));

		service.onUserGone(RIDER);

		verify(realtimeMessageService).sendToUser(eq(CAPTAIN), anyString(),
				eq(RealtimeMessageType.RIDE_RIDER_LEFT), eq(new RideRiderLeftPayload(RIDER, 1)));
		verifyNoInteractions(realtimeEventService, viewportDeltaService);
	}

	@Test
	@DisplayName("따라가지도 이끌지도 않던 사람이 나가면 아무 일도 없다")
	void goneStrangerChangesNothing() {
		when(rideRedisRepository.disband(RIDER))
				.thenReturn(new DisbandResult(false, 0, 0, 0, 0, List.of(), List.of(), List.of()));
		when(rideRedisRepository.riderLeave(RIDER)).thenReturn(null);

		service.onUserGone(RIDER);

		verifyNoInteractions(realtimeMessageService, realtimeEventService,
				viewportDeltaService, meetingService);
	}

	// ── 인솔자가 스스로 해체 ───────────────────────────────

	@Test
	@DisplayName("스스로 풀면 사유가 CAPTAIN_ENDED 로 나간다")
	void captainDisbandSendsEndedReason() {
		when(rideRedisRepository.riderCount(CAPTAIN)).thenReturn(2);
		givenDisbandOk();

		service.disbandByCaptain(CAPTAIN);

		ArgumentCaptor<RideEndedPayload> sent = ArgumentCaptor.forClass(RideEndedPayload.class);
		verify(realtimeMessageService).sendToUser(eq(RIDER), anyString(),
				eq(RealtimeMessageType.RIDE_ENDED), sent.capture());
		assertThat(sent.getValue().reason()).isEqualTo(RideEndReason.CAPTAIN_ENDED);
	}

	/** 인솔자는 안 움직인다. 돌려주는 자리는 내려간 사람들이 남은 곳이다. */
	@Test
	@DisplayName("내린 인원과 남은 자리를 돌려준다")
	void captainDisbandAnswersWithCount() {
		when(rideRedisRepository.riderCount(CAPTAIN)).thenReturn(2);
		givenDisbandOk();

		assertThat(service.disbandByCaptain(CAPTAIN))
				.isEqualTo(new DisbandResponse(2, MUSIC, LAYER));
	}

	@Test
	@DisplayName("따라오는 사람이 없으면 인솔자가 아니라고 거부한다")
	void captainDisbandWithoutRidersIsRejected() {
		when(rideRedisRepository.riderCount(CAPTAIN)).thenReturn(0);

		assertThatThrownBy(() -> service.disbandByCaptain(CAPTAIN))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.RIDE_NOT_CAPTAIN));
	}

	/**
	 * 해체 스크립트는 인원이 0 이어도 재생 정보와 열어 둔 곡 상세를 지운다. 사라진 사람에게는
	 * 맞지만, 살아 있는 인솔자에게는 나중에 타는 사람이 곡을 처음부터 듣게 되는 손해다.
	 * 그래서 세는 것이 먼저고, 0 이면 스크립트까지 가면 안 된다.
	 */
	@Test
	@DisplayName("거부할 때는 해체 스크립트를 부르지 않는다")
	void rejectedDisbandNeverTouchesRedis() {
		when(rideRedisRepository.riderCount(CAPTAIN)).thenReturn(0);

		assertThatThrownBy(() -> service.disbandByCaptain(CAPTAIN))
				.isInstanceOf(CustomException.class);

		verify(rideRedisRepository, never()).disband(anyString());
	}

	/** 세고 나서 부르는 사이가 비어 있다. 그 틈에 전원이 내리면 푼 것이 없다. */
	@Test
	@DisplayName("세고 나서 전원이 내렸으면 같은 거부가 나간다")
	void everyoneLeftInBetweenIsRejected() {
		when(rideRedisRepository.riderCount(CAPTAIN)).thenReturn(2);
		when(rideRedisRepository.disband(CAPTAIN))
				.thenReturn(new DisbandResult(false, 0, 0, 0, 0, List.of(), List.of(), List.of()));

		assertThatThrownBy(() -> service.disbandByCaptain(CAPTAIN))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.RIDE_NOT_CAPTAIN));
	}

	/**
	 * 끊김 정리는 거부를 던지면 안 된다. 던지면 뒤따르는 leaveRide 가 멈춰서, 인솔자도
	 * 따라가던 사람도 아니었던 사람이 끊길 때마다 정리가 통째로 빠진다.
	 */
	@Test
	@DisplayName("끊김 정리는 따라오는 사람이 없어도 던지지 않고 끝까지 간다")
	void goneUserCleanupNeverThrows() {
		when(rideRedisRepository.disband(CAPTAIN))
				.thenReturn(new DisbandResult(false, 0, 0, 0, 0, List.of(), List.of(), List.of()));
		when(rideRedisRepository.riderLeave(CAPTAIN)).thenReturn(new RiderLeaveResult(RIDER, 0));

		service.onUserGone(CAPTAIN);

		verify(rideRedisRepository).riderLeave(CAPTAIN);
		verify(rideRedisRepository, never()).riderCount(anyString());
	}
}
