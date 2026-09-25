package com.ssafy.backend.realtime.service.ride;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.dto.ride.RideRankingItem;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

import lombok.RequiredArgsConstructor;

/**
 * 지금 따라오는 사람이 가장 많은 사람 상위 몇 명을 만든다.
 *
 * 미리 세어 두지 않고 물어볼 때마다 센다. 따로 만든 사본을 두면 정리 경로 하나만 빠져도
 * 아무도 안 태우는 사람이 1위에 남는다. 원본을 그대로 세면 그럴 일이 없다.
 *
 * 다만 세는 일이 Redis 전체 키를 훑는 일이라, 방금 만든 답을 잠깐 들고 있다가 그 사이에
 * 또 물으면 그대로 준다. 화면에 새로고침 버튼이 있어 연타가 그대로 훑기가 되기 때문이다.
 */
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class RideRankingService {

	/**
	 * 인원 많은 순, 같으면 닉네임 오름차순, 그것도 같으면 이메일 순.
	 *
	 * 닉네임은 없을 수도 있고 서로 겹칠 수도 있다. 그래서 마지막에 이메일로 한 번 더 가른다.
	 * 갈라 두지 않으면 같은 상황에서 새로 고칠 때마다 순서가 바뀐다.
	 */
	private static final Comparator<RideRankingItem> RANK_ORDER =
			Comparator.comparingInt(RideRankingItem::riderCount).reversed()
					.thenComparing(RideRankingItem::nickname,
							Comparator.nullsLast(Comparator.naturalOrder()))
					.thenComparing(RideRankingItem::email);

	/** 화면이 열 줄이라 이보다 많이 만들 이유가 없다. 들고 있는 답도 이 수로 만든다. */
	private static final int MAX_LIMIT = 10;

	/** 답을 들고 있는 시간. 길면 방금 탄 사람이 안 보이고, 짧으면 연타가 그대로 훑기가 된다. */
	private static final long CACHE_TTL_MS = 2_000L;

	private final RideRedisRepository rideRedisRepository;
	private final UserDisplayService userDisplayService; // 닉네임과 사진. 5분 동안 기억해 둔다
	private final Clock clock;

	/** 방금 만든 답과 그것이 쓸모 있는 시각. 사람마다 다른 값이 아니라 하나만 둔다. */
	private final AtomicReference<Cached> cached = new AtomicReference<>();

	/**
	 * 들고 있는 답.
	 *
	 * @param expiresAt 이 시각이 지나면 다시 만든다
	 * @param items 가장 많이 태운 순으로 MAX_LIMIT 명까지
	 */
	private record Cached(long expiresAt, List<RideRankingItem> items) {
	}

	/**
	 * 상위 목록을 만든다.
	 *
	 * @param limit 최대 몇 명까지 담을지
	 * @return 1위부터 차례로. 아무도 안 태우고 있으면 빈 목록
	 */
	public List<RideRankingItem> top(int limit) {
		if (limit < 1) {
			return List.of();
		}
		// 들고 있는 답은 늘 MAX_LIMIT 명까지 만들어 두고, 더 적게 달라고 하면 앞에서 잘라 준다.
		// 순위는 이미 1부터 매겨져 있어 앞을 자르면 그대로 1위부터가 된다.
		List<RideRankingItem> all = cachedTop();
		int wanted = Math.min(limit, MAX_LIMIT);
		return wanted >= all.size() ? all : List.copyOf(all.subList(0, wanted));
	}

	/**
	 * 들고 있는 답이 아직 쓸모 있으면 그대로 주고, 아니면 다시 만든다.
	 *
	 * 거의 같은 순간에 둘이 물으면 둘 다 만들 수 있다. 답이 같으므로 그냥 둔다 —
	 * 자물쇠를 걸면 한쪽이 훑기가 끝날 때까지 기다린다.
	 */
	private List<RideRankingItem> cachedTop() {
		long now = clock.millis();
		Cached hit = cached.get();
		if (hit != null && hit.expiresAt() > now) {
			return hit.items();
		}
		List<RideRankingItem> fresh = compute(MAX_LIMIT);
		cached.set(new Cached(now + CACHE_TTL_MS, fresh));
		return fresh;
	}

	/**
	 * 지금 이 순간의 상위 목록을 실제로 만든다.
	 *
	 * @param limit 최대 몇 명까지 담을지
	 * @return 1위부터 차례로. 아무도 안 태우고 있으면 빈 목록
	 */
	private List<RideRankingItem> compute(int limit) {
		// 1. 지금 태우고 있는 사람만 후보다. 아무도 안 태우면 키가 없어 여기서 끝난다.
		Set<String> candidates = rideRedisRepository.captainsWithRiders();
		if (candidates.isEmpty()) {
			return List.of();
		}

		// 2. 인원을 한 번에 센다. 세는 사이에 0 이 된 사람은 이 결과에서 빠져 나온다.
		Map<String, Integer> countByCaptain = rideRedisRepository.riderCountsOf(candidates);
		if (countByCaptain.isEmpty()) {
			return List.of();
		}

		// 3. 인원 많은 순으로 줄인다. 닉네임을 묻는 일이 사람 수만큼 늘지 않게 하려는 것이다.
		List<String> shortlist = shortlistByCount(countByCaptain, limit);

		// 4. 줄인 사람만 닉네임과 사진을 받는다. 넣은 순서 그대로 돌아온다.
		List<UserDisplay> displays = userDisplayService.findAll(shortlist);

		// 5. 최종 순서로 정렬하고 순위를 매긴다.
		List<RideRankingItem> sorted = new ArrayList<>(shortlist.size());
		for (int i = 0; i < shortlist.size(); i++) {
			String email = shortlist.get(i);
			UserDisplay display = displays.get(i);
			sorted.add(new RideRankingItem(
					0, email, display.nickname(), display.imageUrl(), countByCaptain.get(email)));
		}
		sorted.sort(RANK_ORDER);

		List<RideRankingItem> ranked = new ArrayList<>(Math.min(limit, sorted.size()));
		for (int i = 0; i < limit && i < sorted.size(); i++) {
			RideRankingItem item = sorted.get(i);
			ranked.add(new RideRankingItem(
					i + 1, item.email(), item.nickname(), item.imageUrl(), item.riderCount()));
		}
		return List.copyOf(ranked);
	}

	/**
	 * 인원 많은 순으로 자르되, 경계에 걸린 동점자는 남긴다.
	 *
	 * 딱 limit 명만 남기면 경계에서 인원이 같은 사람 중 누가 들어올지를 Redis 를 훑은 순서가
	 * 정하게 된다. 그 순서는 매번 다르므로 새로 고칠 때마다 다른 사람이 10위에 뜬다.
	 * 동점자를 다 남겨 두고 닉네임으로 가른 뒤에 잘라야 순서가 고정된다.
	 *
	 * @return 인원 많은 순으로 줄인 이메일 목록
	 */
	private static List<String> shortlistByCount(Map<String, Integer> countByCaptain, int limit) {
		List<Map.Entry<String, Integer>> byCount = countByCaptain.entrySet().stream()
				.sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
				.toList();
		if (byCount.size() <= limit) {
			return byCount.stream().map(Map.Entry::getKey).toList();
		}

		int boundary = byCount.get(limit - 1).getValue();
		int cut = limit;
		while (cut < byCount.size() && byCount.get(cut).getValue() == boundary) {
			cut++;
		}
		return byCount.subList(0, cut).stream().map(Map.Entry::getKey).toList();
	}
}
