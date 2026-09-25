package com.ssafy.backend.realtime.service.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.dto.ride.RideRankingItem;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

/** 인원 많은 순·닉네임 오름차순으로 상위 목록이 고정되는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RideRankingServiceTests {

	@Mock RideRedisRepository rideRedisRepository;
	@Mock UserDisplayService userDisplayService;
	@InjectMocks RideRankingService service;

	private final Map<String, String> nicknameByEmail = new LinkedHashMap<>();

	@Test
	@DisplayName("인원이 많은 사람이 앞에 온다")
	void ordersByRiderCount() {
		given(Map.of("a@x.com", 2, "b@x.com", 5, "c@x.com", 3),
				Map.of("a@x.com", "가", "b@x.com", "나", "c@x.com", "다"));

		List<RideRankingItem> top = service.top(10);

		assertThat(top).extracting(RideRankingItem::email)
				.containsExactly("b@x.com", "c@x.com", "a@x.com");
		assertThat(top).extracting(RideRankingItem::riderCount).containsExactly(5, 3, 2);
	}

	/** 인원이 1~3 에 몰려 동점이 흔하다. 기준이 없으면 새로 고칠 때마다 순서가 바뀐다. */
	@Test
	@DisplayName("인원이 같으면 닉네임 오름차순으로 온다")
	void breaksTieByNickname() {
		given(Map.of("a@x.com", 3, "b@x.com", 3, "c@x.com", 3),
				Map.of("a@x.com", "다", "b@x.com", "가", "c@x.com", "나"));

		List<RideRankingItem> top = service.top(10);

		assertThat(top).extracting(RideRankingItem::nickname).containsExactly("가", "나", "다");
	}

	@Test
	@DisplayName("순위는 1부터 차례로 매겨진다")
	void ranksFromOneWithoutGaps() {
		given(Map.of("a@x.com", 3, "b@x.com", 3, "c@x.com", 1),
				Map.of("a@x.com", "가", "b@x.com", "나", "c@x.com", "다"));

		assertThat(service.top(10)).extracting(RideRankingItem::rank).containsExactly(1, 2, 3);
	}

	@Test
	@DisplayName("정해진 인원까지만 담는다")
	void cutsToLimit() {
		given(Map.of("a@x.com", 5, "b@x.com", 4, "c@x.com", 3),
				Map.of("a@x.com", "가", "b@x.com", "나", "c@x.com", "다"));

		assertThat(service.top(2)).extracting(RideRankingItem::email)
				.containsExactly("a@x.com", "b@x.com");
	}

	/**
	 * 경계에서 인원이 같은 사람을 미리 잘라 버리면, 누가 남을지를 Redis 를 훑은 순서가 정하게 된다.
	 * 그 순서는 매번 다르므로 새로 고칠 때마다 마지막 자리가 바뀐다.
	 */
	@Test
	@DisplayName("경계에 걸린 동점자도 닉네임으로 가려 뽑는다")
	void keepsTiesAtTheCutBeforeSorting() {
		Map<String, Integer> counts = new LinkedHashMap<>();
		counts.put("late@x.com", 4);   // 훑은 순서로는 맨 앞이지만 닉네임은 맨 뒤
		counts.put("mid@x.com", 4);
		counts.put("early@x.com", 4);
		given(counts, Map.of("late@x.com", "다", "mid@x.com", "나", "early@x.com", "가"));

		assertThat(service.top(2)).extracting(RideRankingItem::email)
				.containsExactly("early@x.com", "mid@x.com");
	}

	/** 탈퇴했거나 아직 닉네임을 안 정한 사람이다. 목록이 깨지면 안 된다. */
	@Test
	@DisplayName("닉네임이 없는 사람은 맨 뒤로 간다")
	void nullNicknameGoesLast() {
		Map<String, Integer> counts = new LinkedHashMap<>();
		counts.put("none@x.com", 3);
		counts.put("named@x.com", 3);
		Map<String, String> nicknames = new LinkedHashMap<>();
		nicknames.put("none@x.com", null);
		nicknames.put("named@x.com", "가");
		given(counts, nicknames);

		assertThat(service.top(10)).extracting(RideRankingItem::email)
				.containsExactly("named@x.com", "none@x.com");
	}

	/** 닉네임은 서로 겹칠 수 있다. 그때도 순서가 흔들리면 안 된다. */
	@Test
	@DisplayName("닉네임까지 같으면 이메일 순으로 갈린다")
	void breaksTieByEmailWhenNicknamesMatch() {
		Map<String, Integer> counts = new LinkedHashMap<>();
		counts.put("zzz@x.com", 2);
		counts.put("aaa@x.com", 2);
		given(counts, Map.of("zzz@x.com", "같은이름", "aaa@x.com", "같은이름"));

		assertThat(service.top(10)).extracting(RideRankingItem::email)
				.containsExactly("aaa@x.com", "zzz@x.com");
	}

	@Test
	@DisplayName("아무도 안 태우고 있으면 빈 목록이고 인원을 세지 않는다")
	void emptyWhenNobodyHasRiders() {
		when(rideRedisRepository.captainsWithRiders()).thenReturn(Set.of());

		assertThat(service.top(10)).isEmpty();
		verify(rideRedisRepository, never()).riderCountsOf(anyCollection());
		verify(userDisplayService, never()).findAll(anyCollection());
	}

	/** 훑은 뒤 세기 전에 전원이 내린 경우다. */
	@Test
	@DisplayName("세어 보니 아무도 안 남았으면 빈 목록이다")
	void emptyWhenAllCountsVanished() {
		when(rideRedisRepository.captainsWithRiders()).thenReturn(Set.of("a@x.com"));
		when(rideRedisRepository.riderCountsOf(anyCollection())).thenReturn(Map.of());

		assertThat(service.top(10)).isEmpty();
		verify(userDisplayService, never()).findAll(anyCollection());
	}

	@Test
	@DisplayName("0명을 달라고 하면 Redis 를 보지도 않는다")
	void zeroLimitTouchesNothing() {
		assertThat(service.top(0)).isEmpty();
		verify(rideRedisRepository, never()).captainsWithRiders();
	}

	/** 인원과 닉네임을 정해 두고, 닉네임 조회는 넣은 순서대로 돌려주게 한다. */
	private void given(Map<String, Integer> counts, Map<String, String> nicknames) {
		nicknameByEmail.clear();
		nicknameByEmail.putAll(nicknames);
		when(rideRedisRepository.captainsWithRiders()).thenReturn(new LinkedHashSet<>(counts.keySet()));
		when(rideRedisRepository.riderCountsOf(anyCollection())).thenReturn(new LinkedHashMap<>(counts));
		when(userDisplayService.findAll(anyCollection())).thenAnswer(call -> {
			Collection<?> emails = call.getArgument(0);
			return emails.stream()
					.map(email -> new UserDisplay(nicknameByEmail.get(email.toString()), null))
					.toList();
		});
	}
}
