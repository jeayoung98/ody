package com.ssafy.backend.realtime.nearby.repository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

/**
 * 근처 사람 목록이 쓰는 레디스 읽기.
 * "listeners:{곡id}" = 지금 그 곡을 틀고 있는 사람들(email) 모음. 이건 재생/입장/퇴장 쪽(-75)이 계속 채워둔다.
 * 여기서는 읽기만 한다(사람을 넣고 빼는 건 T2·T3에서 붙임). realtime 켰을 때만 뜬다.
 */
@Repository
@Profile("realtime")
@RequiredArgsConstructor
public class NearbyRedisRepository {

	private static final String LISTENERS_PREFIX = "listeners:";

	private final StringRedisTemplate redis;

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
}
