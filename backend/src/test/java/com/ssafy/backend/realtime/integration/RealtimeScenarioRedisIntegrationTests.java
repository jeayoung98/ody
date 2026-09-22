package com.ssafy.backend.realtime.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.presence.OnlineStatusService;
import com.ssafy.backend.realtime.dto.presence.JoinRequest;
import com.ssafy.backend.realtime.dto.ride.DisbandResponse;
import com.ssafy.backend.realtime.dto.ride.DismountResponse;
import com.ssafy.backend.realtime.dto.ride.RideEndReason;
import com.ssafy.backend.realtime.dto.ride.RideEndedPayload;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackEvent;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackRequest;
import com.ssafy.backend.realtime.dto.ride.RideRiderJoinedPayload;
import com.ssafy.backend.realtime.dto.ride.RideTrackPayload;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.service.ride.RidePlaybackService;

/**
 * 실시간 기능 전체를 실제 Redis 와 실제 Lua 로 돌려 본다.
 *
 * 단위 테스트는 기능 하나를 가짜 이웃과 함께 본다. 여기서는 반대로, 여러 기능이 같은 키를
 * 나눠 쓰는 상황만 본다 — 한쪽이 바꾼 것을 다른 쪽이 못 따라가서 생겼던 문제들이다.
 *
 * 바깥 세계만 가짜로 둔다. DB(재생 기록·만남), 곡 좌표, 사용자 표시, 내보내는 메시지 넷이다.
 * Redis·Lua·서비스는 전부 실물이라 키가 실제로 어떻게 남는지 그대로 확인할 수 있다.
 */
@Import(JdbcTransactionOnlyConfig.class)
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
@SpringBootTest(properties = {
		"spring.profiles.active=test,realtime",
		"spring.data.redis.host=${REDIS_TEST_HOST:127.0.0.1}",
		"spring.data.redis.port=${REDIS_TEST_PORT:6380}",
		// 스케줄러가 시험 중에 끼어들지 않게 한다. 만료 정리는 테스트가 직접 부른다.
		"realtime.presence.sweep-interval-ms=3600000",
		"realtime.presence.recount-interval-ms=3600000",
		"realtime.viewport.cell-counts-interval-ms=3600000",
})
class RealtimeScenarioRedisIntegrationTests extends RealtimeScenarioSupport {

	@Autowired OnlineStatusService onlineStatusService;
	@Autowired RidePlaybackService ridePlaybackService;

	// ── 탭은 마지막 것만 산다 ───────────────────────────────

	/**
	 * 새 탭을 열면 앞의 탭은 죽는다. 그 뒤에 앞의 탭이 닫히면서 종료 신호가 뒤늦게 온다.
	 *
	 * 이때 지금 살아 있는 탭의 선단까지 같이 해제하면 안 된다.
	 * 옛 접속 번호로 온 종료는 아무 일도 하지 않고 넘어가야 한다.
	 */
	@Test
	@DisplayName("인솔자가 옛 탭을 닫아도 선단은 그대로다")
	void closingAnOldTabKeepsTheFleet() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		// 인솔자가 탭을 하나 더 연다. 접속 번호가 올라가고 앞의 탭은 여기서 죽는다.
		presenceService.connect(captain, 2L);
		presenceService.join(captain, 2L, new JoinRequest(1L, LAYER, SONG_A));
		rideService.mount(rider, captain);

		// 뒤늦게 앞의 탭이 닫힌다. 접속 번호는 1 이다.
		presenceService.leave(captain, 1L);

		assertThat(rideRepository.riders(captain)).containsExactly(rider);
		assertThat(redis.hasKey("ride:captain:" + rider)).isTrue();
	}

	/** 만료 목록을 읽은 뒤 하트비트가 도착한 경우다. 아직 살아 있다. */
	@Test
	@DisplayName("만료 전 정리가 돌아도 선단은 그대로다")
	void sweepBeforeExpiryKeepsTheFleet() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);

		presenceService.leaveExpired(captain, System.currentTimeMillis() - 60_000);

		assertThat(rideRepository.riders(captain)).containsExactly(rider);
	}

	/** 따라가기 정보가 남으면 조작이 막힌 채 갇힌다. */
	@Test
	@DisplayName("따라가던 사람이 다시 연결하면 단독으로 돌아온다")
	void reconnectingRiderComesBackAlone() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);

		presenceService.connect(rider, 2L);

		assertThat(redis.hasKey("ride:captain:" + rider)).isFalse();
		assertThat(rideRepository.riders(captain)).isEmpty();
		// 갇히지 않는다 — 다시 곡에 설 수 있다.
		presenceService.join(rider, 2L, new JoinRequest(1L, LAYER, SONG_B));
		assertThat(redis.opsForSet().isMember("listeners:" + SONG_B, rider)).isTrue();
	}

	// ── 따라가는 사람은 지도에 없다 ─────────────────────────

	/** 지도에 없는 사람을 또 빼면 같은 자리에 있던 남이 화면에서 사라진다. */
	@Test
	@DisplayName("인솔자가 곡을 바꿔도 같은 자리의 남은 그대로 세어진다")
	void captainChangingSongKeepsOthersCounted() {
		String other = stand(SONG_A);
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		String cell = cellOf(other);
		rideService.mount(rider, captain);
		assertThat(cellCount(LAYER, cell)).isEqualTo(2); // 남 + 인솔자

		musicPlayService.play(captain, SONG_C, "MAP", LAYER);

		// 인솔자만 빠진다. 따라가는 사람은 애초에 이 자리에 없었다.
		assertThat(cellCount(LAYER, cell)).isEqualTo(1);
		assertThat(redis.opsForSet().isMember("listeners:" + SONG_A, other)).isTrue();
	}

	/** 지도에 없던 사람이다. 빼면 인솔자 자리가 깎이고 보인 적 없는 사람의 퇴장이 나간다. */
	@Test
	@DisplayName("따라가던 사람이 끊겨도 인솔자 자리의 인원수는 그대로다")
	void riderLeavingKeepsCaptainCellCount() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);
		String cell = cellOf(captain);
		assertThat(cellCount(LAYER, cell)).isEqualTo(1);

		presenceService.leave(rider, 1L);

		assertThat(cellCount(LAYER, cell)).isEqualTo(1);
		assertThat(redis.opsForSet().isMember("listeners:" + SONG_A, captain)).isTrue();
	}

	// ── 인솔자가 층을 옮기면 같이 간다 ──────────────────────

	/** 안 따라가면 인솔자는 새 층, 따라가는 사람은 옛 층에 남아 선단이 갈라진다. */
	@Test
	@DisplayName("인솔자가 층을 옮기면 따라가는 사람도 그 층에 내린다")
	void riderFollowsCaptainToAnotherLayer() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);

		presenceService.join(captain, 1L, new JoinRequest(2L, OTHER_LAYER, SONG_A));

		assertThat(presenceRepository.snapshot(rider).layer()).isEqualTo(OTHER_LAYER);
		DismountResponse response = rideService.dismount(rider);
		assertThat(response.layer()).isEqualTo(OTHER_LAYER);
		assertThat(response.musicId()).isEqualTo(SONG_A);
		assertThat(redis.opsForSet()
				.isMember("layer-listeners:" + OTHER_LAYER + ":" + SONG_A, rider)).isTrue();
	}

	// ── 인솔자가 아는 것 ───────────────────────────────────

	/** 인솔자가 인원수를 아는 길이 이것뿐이다. 없으면 누가 내릴 때까지 모른다. */
	@Test
	@DisplayName("누가 타면 인솔자에게 이름과 인원수가 간다")
	void mountTellsCaptain() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);

		rideService.mount(rider, captain);

		ArgumentCaptor<RideRiderJoinedPayload> sent =
				ArgumentCaptor.forClass(RideRiderJoinedPayload.class);
		verify(realtimeMessageService).sendToUser(
				eq(captain), anyString(), eq(RealtimeMessageType.RIDE_RIDER_JOINED), sent.capture());
		assertThat(sent.getValue().email()).isEqualTo(rider);
		assertThat(sent.getValue().riderCount()).isEqualTo(1);
	}

	@Test
	@DisplayName("두 명이 타면 인원수가 하나씩 올라간다")
	void secondMountCountsTwo() {
		String captain = stand(SONG_A);
		String first = stand(SONG_B);
		String second = stand(SONG_C);

		rideService.mount(first, captain);
		rideService.mount(second, captain);

		ArgumentCaptor<RideRiderJoinedPayload> sent =
				ArgumentCaptor.forClass(RideRiderJoinedPayload.class);
		verify(realtimeMessageService, times(2)).sendToUser(
				eq(captain), anyString(), eq(RealtimeMessageType.RIDE_RIDER_JOINED), sent.capture());
		assertThat(sent.getAllValues())
				.extracting(RideRiderJoinedPayload::riderCount)
				.containsExactly(1, 2);
	}

	// ── 따라가는 동안의 기록 ───────────────────────────────

	/**
	 * 번호가 사람마다 다른 유일한 값이다. 하나를 돌려 쓰면 곡별 청취시간이 한 사람에게 몰린다.
	 */
	@Test
	@DisplayName("인솔자가 곡을 바꾸면 각자 다른 기록 번호를 받는다")
	void trackCarriesOwnPlayHistoryId() {
		String captain = stand(SONG_A);
		String first = stand(SONG_B);
		String second = stand(SONG_C);
		rideService.mount(first, captain);
		rideService.mount(second, captain);
		clearInvocations(realtimeMessageService);

		musicPlayService.play(captain, SONG_C, "MAP", LAYER);

		assertThat(trackIdOf(first))
				.isNotNull()
				.isNotEqualTo(trackIdOf(second));
	}

	// ── 접속 여부 ──────────────────────────────────────────

	/** 따라가는 사람은 지도에서 빠져 있다. 그래도 접속은 하고 있다. */
	@Test
	@DisplayName("따라가는 사람도 접속 중으로 나온다")
	void riderIsStillOnline() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);

		assertThat(onlineStatusService.isOnline(rider)).isTrue();
		assertThat(redis.opsForSet().isMember("listeners:" + SONG_A, rider)).isFalse();
	}

	@Test
	@DisplayName("접속을 끊으면 접속 중이 아니게 된다")
	void leavingGoesOffline() {
		String email = stand(SONG_A);
		assertThat(onlineStatusService.isOnline(email)).isTrue();

		presenceService.leave(email, 1L);

		assertThat(onlineStatusService.isOnline(email)).isFalse();
	}

	/** 그 사람에게 간 곡 변경 알림의 기록 번호. */
	private Long trackIdOf(String email) {
		ArgumentCaptor<RideTrackPayload> sent = ArgumentCaptor.forClass(RideTrackPayload.class);
		verify(realtimeMessageService).sendToUser(
				eq(email), anyString(), eq(RealtimeMessageType.RIDE_TRACK), sent.capture());
		return sent.getValue().playHistoryId();
	}

	// ── 선단의 흔적 ────────────────────────────────────────

	/** 남겨 두면 인솔자가 혼자 곡을 바꿔도 갱신되지 않아, 다음에 타는 사람이 옛 곡을 받는다. */
	@Test
	@DisplayName("마지막 한 명이 내리면 ride 키가 하나도 남지 않는다")
	void lastDismountLeavesNoRideKeys() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);
		// 따라오는 사람이 있는 상태로 곡을 바꿔야 재생 정보가 생긴다.
		musicPlayService.play(captain, SONG_C, "MAP", LAYER);
		assertThat(redis.hasKey("ride:playback:" + captain)).isTrue();

		rideService.dismount(rider);

		assertThat(redis.hasKey("ride:riders:" + captain)).isFalse();
		assertThat(redis.hasKey("ride:playback:" + captain)).isFalse();
		assertThat(redis.hasKey("ride:panel:" + captain)).isFalse();
		assertThat(redis.hasKey("ride:captain:" + rider)).isFalse();
		assertThat(redis.opsForHash().hasKey("presence:user:" + rider, "riding")).isFalse();
	}

	@Test
	@DisplayName("인솔자가 끊기면 전원이 지도로 돌아오고 ride 키가 남지 않는다")
	void captainLeavingReturnsEveryoneToTheMap() {
		String captain = stand(SONG_A);
		String first = stand(SONG_B);
		String second = stand(SONG_C);
		rideService.mount(first, captain);
		rideService.mount(second, captain);
		String cell = cellOf(captain);

		presenceService.leave(captain, 1L);

		assertThat(redis.opsForSet().isMember("listeners:" + SONG_A, first, second))
				.containsValues(true, true);
		assertThat(cellCount(LAYER, cell)).isEqualTo(2); // 인솔자는 빠지고 둘이 남는다
		assertThat(redis.hasKey("ride:riders:" + captain)).isFalse();
		assertThat(redis.hasKey("ride:captain:" + first)).isFalse();
		assertThat(redis.hasKey("ride:captain:" + second)).isFalse();
		verify(realtimeMessageService).sendToUser(eq(first), anyString(),
				eq(RealtimeMessageType.RIDE_ENDED), any());
		verify(realtimeMessageService).sendToUser(eq(second), anyString(),
				eq(RealtimeMessageType.RIDE_ENDED), any());
	}

	// ── 인솔자가 스스로 해체 ───────────────────────────────

	/**
	 * 끊겨서 흩어지는 것과 자리가 다르다. 인솔자가 살아 있으므로 그 곡에는 인솔자까지 셋이 남는다.
	 * 끊김 쪽은 인솔자가 빠져 둘이 남는다 — 같은 스크립트를 쓰지만 결과가 갈리는 유일한 자리다.
	 */
	@Test
	@DisplayName("스스로 풀면 전원이 지도로 돌아오고 인솔자는 제자리에 남는다")
	void captainDisbandKeepsCaptainOnTheMap() {
		String captain = stand(SONG_A);
		String first = stand(SONG_B);
		String second = stand(SONG_C);
		rideService.mount(first, captain);
		rideService.mount(second, captain);
		String cell = cellOf(captain);

		DisbandResponse response = rideService.disbandByCaptain(captain);

		assertThat(response.riderCount()).isEqualTo(2);
		assertThat(redis.opsForSet().isMember("listeners:" + SONG_A, captain, first, second))
				.containsValues(true, true, true);
		assertThat(cellCount(LAYER, cell)).isEqualTo(3); // 인솔자까지 셋이다
		assertThat(redis.hasKey("ride:riders:" + captain)).isFalse();
		assertThat(redis.hasKey("ride:captain:" + first)).isFalse();
		assertThat(redis.hasKey("ride:captain:" + second)).isFalse();
	}

	/** 받는 쪽이 문구를 가르는 근거다. 끊김과 같은 값이 나가면 살아 있는 인솔자를 나갔다고 알린다. */
	@Test
	@DisplayName("스스로 풀면 사유가 CAPTAIN_ENDED 로 간다")
	void captainDisbandSendsEndedReason() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);
		clearInvocations(realtimeMessageService);

		rideService.disbandByCaptain(captain);

		ArgumentCaptor<Object> sent = ArgumentCaptor.forClass(Object.class);
		verify(realtimeMessageService).sendToUser(eq(rider), anyString(),
				eq(RealtimeMessageType.RIDE_ENDED), sent.capture());
		assertThat(((RideEndedPayload) sent.getValue()).reason())
				.isEqualTo(RideEndReason.CAPTAIN_ENDED);
	}

	/**
	 * 이 한 줄이 이 기능에서 제일 조용히 망가지는 자리다.
	 *
	 * 해체 스크립트는 따라오는 사람이 없어도 재생 정보와 열어 둔 곡 상세를 지운다. 끊긴 사람에게는
	 * 맞는 정리지만, 살아 있는 인솔자의 것을 지우면 다음에 타는 사람이 곡을 처음부터 듣는다.
	 * 그래서 거부는 스크립트 앞에서 나야 한다.
	 */
	@Test
	@DisplayName("따라오는 사람이 없으면 거부하고 재생 정보를 건드리지 않는다")
	void rejectedDisbandKeepsThePlaybackSnapshot() {
		String captain = stand(SONG_A);
		// 따라오는 사람이 없어도 인솔자는 재생 조작을 보낸다. 나중에 타는 사람을 위해 서버가 저장해 둔다.
		ridePlaybackService.relay(captain, new RidePlaybackRequest(RidePlaybackEvent.SEEK, 40000L));
		assertThat(redis.hasKey("ride:playback:" + captain)).isTrue();

		assertThatThrownBy(() -> rideService.disbandByCaptain(captain))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.RIDE_NOT_CAPTAIN));

		assertThat(redis.hasKey("ride:playback:" + captain)).isTrue();
	}

	/** 푼 뒤에는 인솔자가 아니다. 버튼을 두 번 눌러도 두 번째는 막혀야 한다. */
	@Test
	@DisplayName("두 번 풀면 두 번째는 거부한다")
	void disbandingTwiceIsRejected() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);
		rideService.disbandByCaptain(captain);

		assertThatThrownBy(() -> rideService.disbandByCaptain(captain))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.RIDE_NOT_CAPTAIN));
	}

	/** 푼 사람은 다시 탈 수 있어야 한다. 흔적이 남아 있으면 줄줄이 따라가기로 막힌다. */
	@Test
	@DisplayName("풀린 사람은 곧바로 다시 탈 수 있다")
	void disbandedRiderCanMountAgain() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);
		rideService.disbandByCaptain(captain);

		rideService.mount(rider, captain);

		assertThat(redis.opsForSet().isMember("ride:riders:" + captain, rider)).isTrue();
	}
}
