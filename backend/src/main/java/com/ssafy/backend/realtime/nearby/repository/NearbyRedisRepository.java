package com.ssafy.backend.realtime.nearby.repository;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

/**
 * 근처 사람 스냅샷 + 델타가 쓰는 레디스 접근.
 * "listeners:{곡id}" = 지금 그 곡을 틀고 있는 전역 사람들(email) 모음. 이건 재생/입장/퇴장 쪽(-75)이 계속 채워둔다.
 * "nearby:subscribers:{곡id}" = 그 곡의 청취자 변화를 받고 싶은 사람들(email) 모음.
 * "nearby:meta:{email}" = 패널을 연 사람이 구독한 곡 목록. 닫을 때 다시 계산하지 않고 이 목록으로 해제한다.
 * realtime 켰을 때만 뜬다.
 */
@Repository
@Profile("realtime")
public class NearbyRedisRepository {

	private static final String PRESENCE_USER_PREFIX = "presence:user:";
	private static final String LISTENERS_PREFIX = "listeners:";
	private static final String SUBSCRIBERS_PREFIX = "nearby:subscribers:";
	private static final String META_PREFIX = "nearby:meta:";
	private static final String META_MUSIC_IDS = "musicIds";

	private final StringRedisTemplate redis;
	private final DefaultRedisScript<Long> nearbySubscriptionReplaceScript;

	public NearbyRedisRepository(StringRedisTemplate redis,
			@Qualifier("nearbySubscriptionReplaceScript")
			DefaultRedisScript<Long> nearbySubscriptionReplaceScript) {
		this.redis = redis;
		this.nearbySubscriptionReplaceScript = nearbySubscriptionReplaceScript;
	}

	/**
	 * 곡 목록을 받아 곡마다 "지금 그 곡 듣는 사람들(email)" 을 돌려준다.
	 * 곡이 몇 개 안 되니(내 곡 + 비슷한 곡 10개 정도) 하나씩 읽어도 충분하다.
	 * 아무도 안 듣는 곡은 빈 목록으로 온다.
	 */
	public Map<Long, Set<String>> listeners(List<Long> musicIds) {
		Map<Long, Set<String>> result = new LinkedHashMap<>();
		for (Long id : musicIds) {
			Set<String> members = redis.opsForSet().members(LISTENERS_PREFIX + id);
			result.put(id, members != null ? members : Set.of());
		}
		return result;
	}

	/**
	 * 주변사람 구독 곡을 새 목록으로 바꾼다.
	 *
	 * @param email 사용자 이메일
	 * @param epoch 접속 버전
	 * @param musicIds 새 구독 곡
	 * @return 현재 접속이면 true
	 */
	public boolean replaceSubscriptions(String email, long epoch, Collection<Long> musicIds) {
		String value = musicIds.stream()
				.filter(java.util.Objects::nonNull)
				.distinct()
				.map(String::valueOf)
				.collect(Collectors.joining(","));
		Long result = redis.execute(nearbySubscriptionReplaceScript,
				List.of(PRESENCE_USER_PREFIX + email, META_PREFIX + email),
				email, Long.toString(epoch), SUBSCRIBERS_PREFIX, value);
		return result != null && result == 1L;
	}

	/** 전달받은 곡별 구독자 Set에서 사용자를 제거한다. 마지막 멤버가 빠진 빈 Set 키는 Redis가 함께 없앤다. */
	public void unsubscribe(String email, Collection<Long> musicIds) {
		for (Long musicId : musicIds) {
			if (musicId != null) {
				redis.opsForSet().remove(SUBSCRIBERS_PREFIX + musicId, email);
			}
		}
	}

	/** 해당 곡의 청취자 변화를 구독 중인 사용자(email)를 조회한다. */
	public Set<String> subscribers(long musicId) {
		Set<String> members = redis.opsForSet().members(SUBSCRIBERS_PREFIX + musicId);
		return members != null ? members : Set.of();
	}

	/** 저장해 둔 구독 곡 목록을 읽는다. 패널을 열지 않았거나 저장값이 비어 있으면 빈 목록이다. */
	public List<Long> subscribedMusicIds(String email) {
		Object value = redis.opsForHash().get(META_PREFIX + email, META_MUSIC_IDS);
		if (value == null || value.toString().isBlank()) {
			return List.of();
		}
		return List.of(value.toString().split(",")).stream()
				.map(Long::valueOf)
				.toList();
	}

	/** 사용자가 근처 패널을 열어 구독 meta를 가지고 있는지 확인한다. */
	public boolean hasMeta(String email) {
		return Boolean.TRUE.equals(redis.hasKey(META_PREFIX + email));
	}

	/** 사용자의 구독 meta를 삭제한다. 곡별 Set 해제는 저장 목록을 읽은 뒤 별도로 수행해야 한다. */
	public void deleteMeta(String email) {
		redis.delete(META_PREFIX + email);
	}
}
