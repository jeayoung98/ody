package com.ssafy.backend.realtime.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.lenient;

import java.time.Clock;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.dto.ride.RideEndReason;
import com.ssafy.backend.realtime.dto.ride.RideRankingItem;
import com.ssafy.backend.realtime.service.ride.RideRankingService;

/**
 * 실시간 탑 버스기사를 실제 Redis 와 실제 Lua 로 돌려 본다 (S15P21A405-678).
 *
 * 단위 시험은 인원을 손으로 정해 넣지만, 여기서는 실제로 태우고 내리고 흩는다.
 * 랭킹이 기대는 것이 "따라오는 사람이 0 명이 되면 Redis 가 키를 스스로 지운다" 라서,
 * 그 일이 실제 경로에서 정말 일어나는지는 실물로만 확인할 수 있다.
 */
@Import(JdbcTransactionOnlyConfig.class)
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_INTEGRATION", matches = "true")
@SpringBootTest(properties = {
		"spring.profiles.active=test,realtime",
		"spring.data.redis.host=${REDIS_TEST_HOST:127.0.0.1}",
		"spring.data.redis.port=${REDIS_TEST_PORT:6380}",
		"realtime.presence.sweep-interval-ms=3600000",
		"realtime.presence.recount-interval-ms=3600000",
		"realtime.presence.ride-orphan-sweep-interval-ms=3600000",
		"realtime.viewport.cell-counts-interval-ms=3600000",
})
class RideRankingScenarioRedisIntegrationTests extends RealtimeScenarioSupport {

	@Autowired RideRankingService rideRankingService;

	/**
	 * 랭킹은 방금 만든 답을 잠깐 들고 있는다. 시간을 직접 밀지 않으면 태우고 내린 결과가
	 * 다음 조회에 안 보인다. 그래서 시계를 가짜로 두고 확인할 때마다 크게 민다.
	 */
	@MockitoBean Clock clock;

	/**
	 * 시험마다 새로 만들면 시각이 되돌아간다. 랭킹을 만드는 쪽은 스프링 빈 하나라
	 * 앞 시험이 들고 있던 답이 아직 쓸모 있는 것으로 보여 그대로 나온다.
	 * 그래서 시험을 가로질러 한 방향으로만 흐르게 둔다.
	 */
	private static final AtomicLong NOW = new AtomicLong(1_000_000L);

	@BeforeEach
	void prepareClockAndNicknames() {
		lenient().when(clock.millis()).thenAnswer(call -> NOW.get());
		// 닉네임은 이메일 그대로 쓴다. 같은 인원끼리는 이메일 순으로 갈리는 것과 결과가 같아진다.
		lenient().when(userDisplayService.findAll(anyCollection())).thenAnswer(call -> {
			Collection<?> emails = call.getArgument(0);
			return emails.stream().map(email -> new UserDisplay(email.toString(), null)).toList();
		});
	}

	/** 들고 있는 답을 버리고 지금 상태로 다시 세게 한다. */
	private List<RideRankingItem> rankingNow() {
		NOW.addAndGet(10_000L);
		return rideRankingService.top(10);
	}

	/** 이 시험이 만든 사람만 남긴다. 훑기는 Redis 전체를 지나가 남의 키도 함께 잡는다. */
	private List<String> minedFrom(List<RideRankingItem> ranking, List<String> mine) {
		return ranking.stream().map(RideRankingItem::email).filter(mine::contains).toList();
	}

	@Test
	@DisplayName("태우고 있는 사람만, 인원 많은 순으로 뜬다")
	void ordersRealCaptainsByRiderCount() {
		String busy = stand(SONG_A);
		String quiet = stand(SONG_B);
		String alone = stand(SONG_C);
		rideService.mount(stand(SONG_C), busy);
		rideService.mount(stand(SONG_C), busy);
		rideService.mount(stand(SONG_A), quiet);

		List<RideRankingItem> ranking = rankingNow();

		assertThat(minedFrom(ranking, List.of(busy, quiet, alone)))
				.containsExactly(busy, quiet);
		assertThat(ranking).filteredOn(item -> item.email().equals(busy))
				.singleElement()
				.extracting(RideRankingItem::riderCount)
				.isEqualTo(2);
	}

	/** 랭킹이 기대는 전제다. 마지막 한 명이 내리면 키가 사라져 후보에서 빠져야 한다. */
	@Test
	@DisplayName("마지막 한 명이 내리면 목록에서 사라진다")
	void captainLeavesRankingWhenLastRiderDismounts() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);
		assertThat(minedFrom(rankingNow(), List.of(captain))).containsExactly(captain);

		rideService.dismount(rider);

		assertThat(minedFrom(rankingNow(), List.of(captain))).isEmpty();
	}

	@Test
	@DisplayName("선단을 흩으면 목록에서 사라진다")
	void captainLeavesRankingAfterDisband() {
		String captain = stand(SONG_A);
		rideService.mount(stand(SONG_B), captain);
		rideService.mount(stand(SONG_C), captain);
		assertThat(minedFrom(rankingNow(), List.of(captain))).containsExactly(captain);

		rideService.disband(captain, RideEndReason.CAPTAIN_ENDED);

		assertThat(minedFrom(rankingNow(), List.of(captain))).isEmpty();
	}

	/** 따라가는 사람은 남을 태우지 못한다. 그 사람이 후보로 잡히면 인원 0 이 목록에 섞인다. */
	@Test
	@DisplayName("따라가는 사람은 목록에 안 뜬다")
	void riderItselfIsNotRanked() {
		String captain = stand(SONG_A);
		String rider = stand(SONG_B);
		rideService.mount(rider, captain);

		assertThat(minedFrom(rankingNow(), List.of(rider))).isEmpty();
	}

	/** 곡만 바꾼 것은 인원이 바뀐 것이 아니다. 순위도 그대로여야 한다. */
	@Test
	@DisplayName("인솔자가 곡을 바꿔도 인원은 그대로다")
	void ridingCountSurvivesTrackChange() {
		String captain = stand(SONG_A);
		rideService.mount(stand(SONG_B), captain);

		moveTo(captain, SONG_C);

		assertThat(rankingNow()).filteredOn(item -> item.email().equals(captain))
				.singleElement()
				.extracting(RideRankingItem::riderCount)
				.isEqualTo(1);
	}
}
