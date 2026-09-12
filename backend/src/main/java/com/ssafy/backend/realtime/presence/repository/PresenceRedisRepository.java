package com.ssafy.backend.realtime.presence.repository;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

/**
 * Redis 키 조립은 반드시 이 Repository 를 거친다 — 키 문자열은 여기에만 존재(data-model §1).
 * presence:user:{email} · presence:expiry(ZSET) · listeners:{musicId} ·
 * active-song:cell:{layer}:{x}:{y} · cell:usercount:{layer}(Hash).
 *
 * 직렬화는 StringRedisTemplate(auth 와 동일) — 모든 값이 UTF-8 문자열로 저장되어 Lua 문자열 비교와 정합.
 */
@Repository
@RequiredArgsConstructor
public class PresenceRedisRepository {

	// 키 포맷(data-model §1) — 오직 여기서만 조립
	private static final String PRESENCE_USER_PREFIX = "presence:user:";
	private static final String EXPIRY_KEY = "presence:expiry";
	private static final String LISTENERS_PREFIX = "listeners:";
	private static final String ACTIVE_CELL_PREFIX = "active-song:cell:";
	private static final String USERCOUNT_PREFIX = "cell:usercount:";

	/** 하트비트 = ZADD XX(존재할 때만 갱신). ZAddArgs 자바 API 대신 이식성 높은 인라인 Lua. */
	private static final DefaultRedisScript<Long> TOUCH_SCRIPT = new DefaultRedisScript<>(
			"return redis.call('ZADD', KEYS[1], 'XX', ARGV[1], ARGV[2])", Long.class);

	private final StringRedisTemplate redis;
	private final DefaultRedisScript<List> presencePlayScript;
	private final DefaultRedisScript<List> presenceLeaveScript;
	private final DefaultRedisScript<Long> usercountRecountScript;

	/** presence 스냅샷 — play 처리 전 old 상태 읽기. 미연결이면 null. */
	public record PresenceSnapshot(Long musicId, Integer layer, Integer cellX, Integer cellY, Long epoch) {
	}

	// ---- 비스크립트 연산 ----

	/** 하트비트 — presence:expiry 만료 시각 갱신(존재할 때만). */
	public void touch(String email, long ttlMs) {
		long score = System.currentTimeMillis() + ttlMs;
		redis.execute(TOUCH_SCRIPT, List.of(EXPIRY_KEY), Long.toString(score), email);
	}

	/** Sweep 대상 — 만료 시각 경과 email 목록. */
	public Set<String> expired(long nowMs) {
		Set<String> res = redis.opsForZSet().rangeByScore(EXPIRY_KEY, Double.NEGATIVE_INFINITY, nowMs);
		return res != null ? res : Set.of();
	}

	/** presence 해시에서 현재 상태를 읽는다. 미연결(epoch 없음)이면 null. */
	public PresenceSnapshot snapshot(String email) {
		List<Object> v = redis.opsForHash().multiGet(PRESENCE_USER_PREFIX + email,
				List.of("musicId", "layer", "cellX", "cellY", "epoch"));
		if (v == null || v.get(4) == null) {
			return null; // epoch 없으면 presence 자체가 없는 것
		}
		return new PresenceSnapshot(toLong(v.get(0)), toInt(v.get(1)), toInt(v.get(2)), toInt(v.get(3)), toLong(v.get(4)));
	}

	public Long currentLayer(String email) {
		Object v = redis.opsForHash().get(PRESENCE_USER_PREFIX + email, "layer");
		return v == null ? null : Long.valueOf(v.toString());
	}

	// ---- 스크립트 연산 ----

	/**
	 * 곡 변경 원자 갱신(presence-play.lua).
	 * old값(musicId·cell)은 호출 전 {@link #snapshot(String)} 으로 읽어 넘긴다. 비노출이면 old* = null.
	 *
	 * @return 진입 직전 신곡 청취자 email 목록(만남 판정용, 빈 목록 가능). old 불일치/미연결(STALE)이면 null.
	 */
	@SuppressWarnings("unchecked")
	public List<String> applyPlay(String email,
			Long oldMusicId, Integer oldCellX, Integer oldCellY,
			long newMusicId, int layer, double x, double y, int newCellX, int newCellY) {

		boolean hasOld = oldMusicId != null;
		String oldM = hasOld ? oldMusicId.toString() : "";
		int ocx = hasOld && oldCellX != null ? oldCellX : 0;
		int ocy = hasOld && oldCellY != null ? oldCellY : 0;

		List<String> keys = List.of(
				LISTENERS_PREFIX + (hasOld ? oldMusicId : 0L),                 // KEYS[1] 비노출이면 미사용 placeholder
				LISTENERS_PREFIX + newMusicId,                                 // KEYS[2]
				ACTIVE_CELL_PREFIX + layer + ":" + ocx + ":" + ocy,            // KEYS[3]
				ACTIVE_CELL_PREFIX + layer + ":" + newCellX + ":" + newCellY,  // KEYS[4]
				USERCOUNT_PREFIX + layer,                                      // KEYS[5]
				PRESENCE_USER_PREFIX + email);                                 // KEYS[6]

		List<String> result = redis.execute(presencePlayScript, keys,
				email, oldM, Long.toString(newMusicId), Integer.toString(layer),
				Double.toString(x), Double.toString(y), Integer.toString(newCellX), Integer.toString(newCellY),
				ocx + ":" + ocy, newCellX + ":" + newCellY);

		if (result == null || result.isEmpty() || "STALE".equals(result.get(0))) {
			return null; // 미연결/old 불일치
		}
		return result.subList(1, result.size()); // 'OK' 이후 = 만남 목록
	}

	/**
	 * 이탈 정리 원자(presence-leave.lua). 곡·셀은 스크립트 안에서 읽어 정리.
	 *
	 * @return 제거된 [musicId, layer, cellX, cellY] 또는 빈 목록(no-op·비노출).
	 */
	@SuppressWarnings("unchecked")
	public List<String> applyLeave(String email, long epoch) {
		List<String> keys = List.of(PRESENCE_USER_PREFIX + email, EXPIRY_KEY);
		List<String> result = redis.execute(presenceLeaveScript, keys,
				email, Long.toString(epoch), LISTENERS_PREFIX, ACTIVE_CELL_PREFIX, USERCOUNT_PREFIX);
		return result != null ? result : List.of();
	}

	/**
	 * 셀 인원수 재검증(usercount-recount.lua). 검증할 셀 목록(active-song 셀 ∪ usercount 필드)은
	 * 여기서 SCAN·HKEYS 로 모아 스크립트에 넘긴다.
	 *
	 * @return 불일치(수정)한 셀 수.
	 */
	public long recount(long layer) {
		Set<String> fields = new LinkedHashSet<>();

		// (1) 기존 usercount 필드 — 곡 사라졌지만 남은 유령 카운트도 대상
		Set<Object> uc = redis.opsForHash().keys(USERCOUNT_PREFIX + layer);
		if (uc != null) {
			for (Object f : uc) {
				fields.add(f.toString());
			}
		}
		// (2) active-song:cell:{layer}:* 스캔 → "x:y" 필드 추출
		String prefix = ACTIVE_CELL_PREFIX + layer + ":";
		ScanOptions opts = ScanOptions.scanOptions().match(prefix + "*").count(256).build();
		try (Cursor<String> cursor = redis.scan(opts)) {
			while (cursor.hasNext()) {
				fields.add(cursor.next().substring(prefix.length()));
			}
		}
		if (fields.isEmpty()) {
			return 0;
		}

		List<String> args = new ArrayList<>(fields.size() + 3);
		args.add(Long.toString(layer));
		args.add(ACTIVE_CELL_PREFIX);
		args.add(LISTENERS_PREFIX);
		args.addAll(fields);

		Long n = redis.execute(usercountRecountScript, List.of(USERCOUNT_PREFIX + layer), args.toArray());
		return n != null ? n : 0L;
	}

	private static Long toLong(Object o) {
		return o == null ? null : Long.valueOf(o.toString());
	}

	private static Integer toInt(Object o) {
		return o == null ? null : Integer.valueOf(o.toString());
	}
}
