package com.ssafy.backend.realtime.repository.redis;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

/**
 * 근처 사람 목록과 변경 알림이 쓰는 Redis 저장소.
 * "listeners:{곡id}" = 지금 그 곡을 틀고 있는 전역 사람들(email) 모음. 이건 재생/입장/퇴장 쪽(-75)이 계속 채워둔다.
 * "nearby:layer-subscribers:{층}" = 그 층의 변화를 받고 싶은 사람들(email) 모음.
 * "nearby:meta:{email}" = 패널을 연 사람이 구독한 곡 목록. 닫을 때 다시 계산하지 않고 이 목록으로 해제한다.
 * realtime 켰을 때만 뜬다.
 */
@Repository
@Profile("realtime")
public class NearbyRedisRepository {

	private static final String PRESENCE_USER_PREFIX = "presence:user:"; // 사용자 현재 상태
	private static final String LISTENERS_PREFIX = "listeners:"; // 곡별 현재 청취자
	private static final String LAYER_SUBSCRIBERS_PREFIX = "nearby:layer-subscribers:"; // 층별 주변사람 변경 수신자
	private static final String META_PREFIX = "nearby:meta:"; // 사용자별 주변사람 구독 정보

	private final StringRedisTemplate redis; // Redis 읽기와 쓰기
	private final DefaultRedisScript<Long> nearbySubscriptionReplaceScript; // 구독 곡 등록과 교체
	private final DefaultRedisScript<Long> nearbySubscriptionCloseScript; // 현재 접속의 구독 종료

	public NearbyRedisRepository(StringRedisTemplate redis,
			@Qualifier("nearbySubscriptionReplaceScript")
			DefaultRedisScript<Long> nearbySubscriptionReplaceScript,
			@Qualifier("nearbySubscriptionCloseScript")
			DefaultRedisScript<Long> nearbySubscriptionCloseScript) {
		this.redis = redis;
		this.nearbySubscriptionReplaceScript = nearbySubscriptionReplaceScript;
		this.nearbySubscriptionCloseScript = nearbySubscriptionCloseScript;
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
	 * 주변사람 구독을 그 층 하나로 바꾼다 (S15P21A405-582).
	 *
	 * 예전에는 비슷한 곡 열한 개를 곡마다 등록했다. 기준이 층 전체가 되면서 등록도 하나가 된다 —
	 * 같은 층에서 곡만 바꾸는 사람은 구독을 건드릴 일이 없어졌다.
	 *
	 * @param email 사용자 이메일
	 * @param epoch 접속 버전
	 * @param layer 새로 구독할 층
	 * @return 현재 접속이면 true
	 */
	public boolean replaceSubscriptions(String email, long epoch, int layer) {
		Long result = redis.execute(nearbySubscriptionReplaceScript,
				List.of(PRESENCE_USER_PREFIX + email, META_PREFIX + email),
				email, Long.toString(epoch), LAYER_SUBSCRIBERS_PREFIX, Integer.toString(layer));
		return result != null && result == 1L;
	}

	/** 현재 접속이(현재 세션아이디일때) 요청한 주변사람 구독만 닫는다 */
	public boolean closeSubscriptions(String email, long epoch) {
		Long result = redis.execute(nearbySubscriptionCloseScript,
				List.of(META_PREFIX + email),
				email, Long.toString(epoch), LAYER_SUBSCRIBERS_PREFIX);
		return result != null && result == 1L;
	}

	/** 그 층의 변화를 구독 중인 사용자(email)를 조회한다. */
	public Set<String> subscribers(int layer) {
		Set<String> members = redis.opsForSet().members(LAYER_SUBSCRIBERS_PREFIX + layer);
		return members != null ? members : Set.of();
	}

	/** 사용자가 주변사람 변경 알림을 받고 있는지 확인한다. */
	public boolean hasSubscription(String email) {
		return Boolean.TRUE.equals(redis.hasKey(META_PREFIX + email));
	}
}
