package com.ssafy.backend.realtime.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import com.ssafy.backend.realtime.dto.nearby.NearbyChange;
import com.ssafy.backend.realtime.dto.nearby.NearbyPerson;
import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;

/**
 * 주변 사람을 실제 Redis 와 실제 Lua 로 돌려 본다 (S15P21A405-582).
 *
 * 기준이 내 곡과 비슷한 곡에서 내 층 전체로 바뀌었다. 단위 시험은 조각마다 가짜 이웃을 끼우지만,
 * 여기서는 재생 선언이 채운 키를 목록과 구독과 델타가 나눠 읽는 상황을 그대로 본다 —
 * 한쪽이 바꾼 것을 다른 쪽이 못 따라가서 생겼던 문제들이다.
 */
@Import(JdbcTransactionOnlyConfig.class)
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
@SpringBootTest(properties = {
		"spring.profiles.active=test,realtime",
		"spring.data.redis.host=${REDIS_TEST_HOST:127.0.0.1}",
		"spring.data.redis.port=${REDIS_TEST_PORT:6380}",
		"realtime.presence.sweep-interval-ms=3600000",
		"realtime.presence.recount-interval-ms=3600000",
		"realtime.viewport.cell-counts-interval-ms=3600000",
})
class NearbyScenarioRedisIntegrationTests extends RealtimeScenarioSupport {

	@Autowired NearbyPeopleService nearbyPeopleService;

	// ── 목록 ───────────────────────────────────────────────

	/**
	 * 예전 기준이면 SONG_C 는 SONG_A 와 멀어 목록에 못 들어왔다. 이제는 같은 층이기만 하면 담긴다.
	 * 이 한 줄이 이 티켓이 바꾸려던 것 전부다.
	 */
	@Test
	@DisplayName("같은 층이면 곡이 멀어도 목록에 담긴다")
	void everyoneOnMyLayerIsListed() {
		String me = stand(SONG_A);
		String near = stand(SONG_B);
		String far = stand(SONG_C);

		NearbySnapshot snapshot = nearbyPeopleService.open(me);

		assertThat(snapshot.people()).extracting(NearbyPerson::email)
				.containsExactlyInAnyOrder(near, far);
		assertThat(snapshot.anchorMusicId()).isEqualTo(SONG_A);
	}

	@Test
	@DisplayName("다른 층 사람은 담기지 않는다")
	void otherLayerIsNotListed() {
		String me = stand(SONG_A);
		String elsewhere = stand(SONG_B);
		moveToLayer(elsewhere, OTHER_LAYER, SONG_B);

		assertThat(nearbyPeopleService.open(me).people()).extracting(NearbyPerson::email)
				.doesNotContain(elsewhere);
	}

	/** 곡 위에 서지 않은 사람은 지도에 없다. 목록도 지도와 같은 키를 읽으므로 같이 빠진다. */
	@Test
	@DisplayName("접속만 하고 곡을 안 튼 사람은 담기지 않는다")
	void watcherIsNotListed() {
		String me = stand(SONG_A);
		String watching = watcher();

		assertThat(nearbyPeopleService.open(me).people()).extracting(NearbyPerson::email)
				.doesNotContain(watching);
	}

	/** 자리를 줘야 받는 쪽이 패널을 미니맵으로 그린다. 거리는 정렬과 레이더 반지름에 쓴다. */
	@Test
	@DisplayName("사람마다 곡의 자리와 내 자리에서의 거리가 담긴다")
	void peopleCarrySpotAndDistance() {
		String me = stand(SONG_A);
		String other = stand(SONG_B);

		NearbyPerson person = nearbyPeopleService.open(me).people().stream()
				.filter(p -> p.email().equals(other)).findFirst().orElseThrow();

		// SONG_A 는 (1,1), SONG_B 는 (5,5) 에 있다.
		assertThat(person.x()).isEqualTo(5.0);
		assertThat(person.y()).isEqualTo(5.0);
		assertThat(person.distance()).isCloseTo(Math.hypot(4.0, 4.0), org.assertj.core.data.Offset.offset(1e-9));
	}

	@Test
	@DisplayName("목록은 가까운 순이다")
	void listedNearestFirst() {
		String me = stand(SONG_A);
		String far = stand(SONG_C);
		String near = stand(SONG_B);

		assertThat(nearbyPeopleService.open(me).people()).extracting(NearbyPerson::email)
				.containsExactly(near, far);
	}

	/** 따라가는 사람은 지도 인덱스에서 빠진다. 목록이 같은 키를 읽으므로 여기서도 안 보여야 한다. */
	@Test
	@DisplayName("따라가는 사람은 목록에 안 뜬다")
	void riderIsNotListed() {
		String me = stand(SONG_A);
		String captain = stand(SONG_B);
		String rider = stand(SONG_C);
		rideService.mount(rider, captain);

		assertThat(nearbyPeopleService.open(me).people()).extracting(NearbyPerson::email)
				.contains(captain)
				.doesNotContain(rider);
	}

	// ── 구독과 델타 ─────────────────────────────────────────

	@Test
	@DisplayName("패널을 열면 그 층 하나만 구독한다")
	void openSubscribesToOneLayer() {
		String me = stand(SONG_A);

		nearbyPeopleService.open(me);

		assertThat(redis.opsForSet().isMember("nearby:layer-subscribers:" + LAYER, me)).isTrue();
		assertThat(redis.opsForHash().get("nearby:meta:" + me, "layer"))
				.isEqualTo(Integer.toString(LAYER));
	}

	/** 목록에 그대로 있고 자리만 옮긴다. 좌표가 안 오면 그 사람만 옛 자리에 남는다. */
	@Test
	@DisplayName("같은 층에서 남이 곡을 바꾸면 자리와 함께 MOVE 가 온다")
	void sameLayerSongChangeSendsMoveWithSpot() {
		String me = stand(SONG_A);
		String other = stand(SONG_B);
		nearbyPeopleService.open(me);
		clearInvocations(realtimeMessageService);

		moveTo(other, SONG_C);

		ArgumentCaptor<Object> sent = ArgumentCaptor.forClass(Object.class);
		verify(realtimeMessageService).sendToUser(eq(me), anyString(),
				eq(RealtimeMessageType.NEARBY_MOVE), sent.capture());
		NearbyChange change = (NearbyChange) sent.getValue();
		assertThat(change.email()).isEqualTo(other);
		assertThat(change.musicId()).isEqualTo(SONG_C);
		assertThat(change.x()).isEqualTo(-6.0); // SONG_C 의 자리
	}

	@Test
	@DisplayName("남이 다른 층으로 가면 LEAVE 가 온다")
	void leavingMyLayerSendsLeave() {
		String me = stand(SONG_A);
		String other = stand(SONG_B);
		nearbyPeopleService.open(me);
		clearInvocations(realtimeMessageService);

		moveToLayer(other, OTHER_LAYER, SONG_C);

		verify(realtimeMessageService).sendToUser(eq(me), anyString(),
				eq(RealtimeMessageType.NEARBY_LEAVE), any());
		verify(realtimeMessageService, never()).sendToUser(eq(me), anyString(),
				eq(RealtimeMessageType.NEARBY_MOVE), any());
	}

	/**
	 * 같은 층에서 내가 곡만 바꿔도 목록에 담길 사람은 그대로다. 통째로 다시 만들 이유가 없다.
	 * 예전에는 기준곡이 달라져 곡을 바꿀 때마다 새 목록을 통째로 보냈다.
	 */
	@Test
	@DisplayName("내가 같은 층에서 곡을 바꿔도 새 목록이 오지 않는다")
	void myOwnSongChangeDoesNotResendSnapshot() {
		String me = stand(SONG_A);
		stand(SONG_B);
		nearbyPeopleService.open(me);
		clearInvocations(realtimeMessageService);

		moveTo(me, SONG_C);

		verify(realtimeMessageService, never()).sendToUser(eq(me), anyString(),
				eq(RealtimeMessageType.NEARBY_SNAPSHOT), any());
	}

	/** 층을 옮기면 담길 사람이 통째로 달라진다. 구독도 목록도 다시 만들어야 한다. */
	@Test
	@DisplayName("내가 층을 옮기면 구독이 옮겨 가고 새 목록이 온다")
	void myLayerChangeMovesSubscriptionAndResends() {
		String me = stand(SONG_A);
		stand(SONG_B);
		nearbyPeopleService.open(me);
		clearInvocations(realtimeMessageService);

		moveToLayer(me, OTHER_LAYER, SONG_C);

		assertThat(redis.opsForSet().isMember("nearby:layer-subscribers:" + LAYER, me)).isFalse();
		assertThat(redis.opsForSet().isMember("nearby:layer-subscribers:" + OTHER_LAYER, me)).isTrue();
		verify(realtimeMessageService).sendToUser(eq(me), anyString(),
				eq(RealtimeMessageType.NEARBY_SNAPSHOT), any());
	}

	@Test
	@DisplayName("패널을 닫으면 그 층 구독자에서 빠진다")
	void closeRemovesFromLayer() {
		String me = stand(SONG_A);
		nearbyPeopleService.open(me);

		nearbyPeopleService.close(me, 1L);

		assertThat(redis.opsForSet().isMember("nearby:layer-subscribers:" + LAYER, me)).isFalse();
		assertThat(redis.hasKey("nearby:meta:" + me)).isFalse();
	}

	/** 안 지우면 나간 사람이 그 층 구독자 목록에 영원히 남아, 그 뒤 알림이 허공으로 나간다. */
	@Test
	@DisplayName("접속을 끊으면 층 구독자에서도 빠진다")
	void leaveRemovesFromLayer() {
		String me = stand(SONG_A);
		nearbyPeopleService.open(me);

		presenceService.leave(me, 1L);

		assertThat(redis.opsForSet().isMember("nearby:layer-subscribers:" + LAYER, me)).isFalse();
		assertThat(redis.hasKey("nearby:meta:" + me)).isFalse();
	}

	@Test
	@DisplayName("다른 층을 보는 사람에게는 내 층의 변화가 가지 않는다")
	void otherLayerWatcherGetsNothing() {
		String elsewhere = stand(SONG_A);
		moveToLayer(elsewhere, OTHER_LAYER, SONG_A);
		nearbyPeopleService.open(elsewhere);
		String other = stand(SONG_B);
		clearInvocations(realtimeMessageService);

		moveTo(other, SONG_C);

		verify(realtimeMessageService, never()).sendToUser(eq(elsewhere), anyString(),
				eq(RealtimeMessageType.NEARBY_MOVE), any());
	}

	/** 상한은 가까운 쪽부터 남긴다. 설정값이 12 라 여기서는 안 걸리지만 순서는 확인해 둔다. */
	@Test
	@DisplayName("만난 적 없는 사람은 만난 횟수가 0 이다")
	void meetingCountStartsAtZero() {
		String me = stand(SONG_A);
		stand(SONG_B);

		assertThat(nearbyPeopleService.open(me).people())
				.allSatisfy(p -> assertThat(p.meetingCount()).isZero());
	}

	@Test
	@DisplayName("곡을 한 번도 안 튼 사람은 목록을 열 수 없다")
	void watcherCannotOpen() {
		String watching = watcher();

		org.assertj.core.api.Assertions.assertThatThrownBy(() -> nearbyPeopleService.open(watching))
				.isInstanceOf(com.ssafy.backend.common.CustomException.class);
	}

	@Test
	@DisplayName("그 층에 나뿐이면 목록이 빈다")
	void aloneOnLayerIsEmpty() {
		String me = stand(SONG_A);

		assertThat(nearbyPeopleService.open(me).people()).isEmpty();
	}

	/** 목록에 쓰는 이름은 바깥에서 오므로, 없는 사람도 목록에서 빠지지 않아야 한다. */
	@Test
	@DisplayName("이름이 없어도 목록에는 오른다")
	void missingNicknameStillListed() {
		String me = stand(SONG_A);
		String other = stand(SONG_B);

		List<NearbyPerson> people = nearbyPeopleService.open(me).people();

		assertThat(people).extracting(NearbyPerson::email).contains(other);
	}
}
