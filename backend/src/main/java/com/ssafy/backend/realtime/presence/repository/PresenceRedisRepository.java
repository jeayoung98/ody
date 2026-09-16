package com.ssafy.backend.realtime.presence.repository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

import com.ssafy.backend.realtime.geometry.CellGrid.Cell;

import lombok.RequiredArgsConstructor;

/**
 * Redis 키 조립은 반드시 이 Repository 를 거친다 — 키 문자열은 여기에만 존재(data-model §1).
 * presence:user:{email} · presence:expiry(ZSET) · listeners:{musicId} ·
 * active-song:cell:{layer}:{x}:{y} · cell:usercount:{layer}(Hash).
 *
 * 직렬화는 StringRedisTemplate(auth 와 동일) — 모든 값이 UTF-8 문자열로 저장되어 Lua 문자열 비교와 정합.
 */
@Repository
@Profile("realtime")
@RequiredArgsConstructor
public class PresenceRedisRepository {

	// 키 포맷(data-model §1) — 오직 여기서만 조립
	private static final String PRESENCE_USER_PREFIX = "presence:user:"; // 사용자 현재 상태
	private static final String EXPIRY_KEY = "presence:expiry"; // 사용자별 접속 만료 시각
	private static final String LISTENERS_PREFIX = "listeners:"; // 곡별 전체 청취자
	private static final String LAYER_LISTENERS_PREFIX = "layer-listeners:"; // 레이어와 곡별 청취자
	private static final String ACTIVE_CELL_PREFIX = "active-song:cell:"; // 셀별 재생 중인 곡
	private static final String ACTIVE_CELLS_PREFIX = "active-song:cells:"; // 레이어별 사용 중인 셀
	private static final String USERCOUNT_PREFIX = "cell:usercount:"; // 레이어와 셀별 사용자 수
	private static final String NEARBY_SUBSCRIBERS_PREFIX = "nearby:subscribers:"; // 곡별 주변사람 변경 수신자
	private static final String NEARBY_META_PREFIX = "nearby:meta:"; // 사용자별 주변사람 구독 곡

	/** 하트비트 = ZADD XX(존재할 때만 갱신). ZAddArgs 자바 API 대신 이식성 높은 인라인 Lua. */
	private static final DefaultRedisScript<Long> TOUCH_SCRIPT = new DefaultRedisScript<>(
			"return redis.call('ZADD', KEYS[1], 'XX', 'CH', ARGV[1], ARGV[2])", Long.class);

	private final StringRedisTemplate redis;
	private final DefaultRedisScript<List> presenceJoinScript;
	private final DefaultRedisScript<List> presencePlayScript;
	private final DefaultRedisScript<List> presenceLeaveScript;
	private final DefaultRedisScript<Long> usercountRecountScript;

	/** presence 스냅샷 — play 처리 전 old 상태 읽기. 미연결이면 null. */
	public record PresenceSnapshot(Long musicId, Integer layer, Integer cellX, Integer cellY, Long epoch) {
	}

	// ---- 비스크립트 연산 ----

	/**
	 * 하트비트 — presence:expiry 만료 시각 갱신(존재할 때만, ZADD XX CH).
	 * @return true=갱신됨(살아있음), false=만료큐에 없음(이미 sweep 됨 → STALE, 클라 resync 필요).
	 */
	public boolean touch(String email, long ttlMs) {
		long score = System.currentTimeMillis() + ttlMs;
		Long n = redis.execute(TOUCH_SCRIPT, List.of(EXPIRY_KEY), Long.toString(score), email);
		return n != null && n > 0;
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

	/**
	 * 화면 셀마다 현재 재생 중인 곡을 한 번에 읽는다.
	 * @param layer 현재 레이어
	 * @param cells 확인할 화면 셀
	 * @return 셀별 재생 중인 곡 ID
	 */
	public Map<Cell, Set<Long>> findActiveMusicIdsByCell(int layer, List<Cell> cells) {
		List<String> keys = cells.stream()
				.map(cell -> ACTIVE_CELL_PREFIX + layer + ":" + cell.cellX() + ":" + cell.cellY())
				.toList();
		List<Object> values = readSetsAtOnce(keys);

		Map<Cell, Set<Long>> result = new java.util.LinkedHashMap<>();
		for (int i = 0; i < cells.size(); i++) {
			Set<Long> musicIds = toStringSet(values.get(i)).stream()
					.map(Long::valueOf)
					.collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
			result.put(cells.get(i), Set.copyOf(musicIds));
		}
		return result;
	}

	/**
	 * 곡마다 현재 레이어에서 듣고 있는 사용자를 한 번에 읽는다.
	 * @param layer 현재 레이어
	 * @param musicIds 확인할 곡 ID
	 * @return 곡별 청취자 이메일
	 */
	public Map<Long, Set<String>> findListenersByMusic(int layer, List<Long> musicIds) {
		List<String> keys = musicIds.stream()
				.map(musicId -> LAYER_LISTENERS_PREFIX + layer + ":" + musicId)
				.toList();
		List<Object> values = readSetsAtOnce(keys);

		Map<Long, Set<String>> result = new java.util.LinkedHashMap<>();
		for (int i = 0; i < musicIds.size(); i++) {
			result.put(musicIds.get(i), Set.copyOf(toStringSet(values.get(i))));
		}
		return result;
	}

	/** CONNECT — presence 생성(정지: epoch·connectedAt 만, 곡·좌표 없음 → 남에게 안 보임). 곡 배치는 join 이 한다. */
	public void connect(String email, long epoch, long ttlMs) {
		long now = System.currentTimeMillis();
		Map<String, String> fields = new HashMap<>();
		fields.put("epoch", Long.toString(epoch));
		fields.put("connectedAt", Long.toString(now));
		redis.opsForHash().putAll(PRESENCE_USER_PREFIX + email, fields);
		redis.opsForZSet().add(EXPIRY_KEY, email, (double) (now + ttlMs));
	}

	/**
	 * join = (presence-join.lua). 그 레이어·그 곡에 활성 배치한다(노출). play 와 달리 만남·재생기록(play_history) 없음.
	 * old 값(musicId·layer·cell)은 호출 전 {@link #snapshot(String)} 으로 읽어 넘긴다(정지였으면 old* = null).
	 * 곡·좌표·셀은 Java(CoordinateMapper)에서 계산. 같은 레이어·같은 곡이면 좌표만 갱신(idempotent).
	 *
	 * @return true = 배치 성공, false = presence 없음/old 불일치(STALE, Sweep·재접속 경쟁).
	 */
	@SuppressWarnings("unchecked")
	public boolean join(String email,
			Long oldMusicId, Integer oldLayer, Integer oldCellX, Integer oldCellY,
			long newMusicId, int newLayer, double x, double y, int newCellX, int newCellY) {

		boolean hasOld = oldMusicId != null;
		String oldM = hasOld ? oldMusicId.toString() : "";
		String oldL = (hasOld && oldLayer != null) ? oldLayer.toString() : "";
		String oldCellField = (hasOld && oldCellX != null && oldCellY != null) ? (oldCellX + ":" + oldCellY) : "";
		String newCellField = newCellX + ":" + newCellY;

		List<String> result = redis.execute(presenceJoinScript, List.of(PRESENCE_USER_PREFIX + email),
				email, oldM, oldL, oldCellField,
				Long.toString(newMusicId), Integer.toString(newLayer), newCellField,
				Double.toString(x), Double.toString(y), Integer.toString(newCellX), Integer.toString(newCellY),
				LISTENERS_PREFIX, LAYER_LISTENERS_PREFIX, ACTIVE_CELL_PREFIX, ACTIVE_CELLS_PREFIX, USERCOUNT_PREFIX);

		return result != null && !result.isEmpty() && "OK".equals(result.get(0));
	}

	// ---- 스크립트 연산 ----

	/**
	 * 곡 변경 원자 갱신(presence-play.lua) = 이동. 활성 배치 코어는 join 과 동일 + 만남 목록 반환.
	 * old값(musicId·layer·cell)은 호출 전 {@link #snapshot(String)} 으로 읽어 넘긴다(정지/첫재생이면 old* = null).
	 * old 제거는 반드시 oldLayer 기준(P1-a). 곡 유지 시 전역 listeners 보존.
	 *
	 * @return 진입 직전 새 (레이어,곡) 청취자 email 목록(만남 후보, 나 제외·빈 목록 가능). old 불일치/미연결(STALE)이면 null.
	 */
	@SuppressWarnings("unchecked")
	public List<String> applyPlay(String email,
			Long oldMusicId, Integer oldLayer, Integer oldCellX, Integer oldCellY,
			long newMusicId, int newLayer, double x, double y, int newCellX, int newCellY) {

		boolean hasOld = oldMusicId != null;
		String oldM = hasOld ? oldMusicId.toString() : "";
		String oldL = (hasOld && oldLayer != null) ? oldLayer.toString() : "";
		String oldCellField = (hasOld && oldCellX != null && oldCellY != null) ? (oldCellX + ":" + oldCellY) : "";
		String newCellField = newCellX + ":" + newCellY;

		List<String> result = redis.execute(presencePlayScript, List.of(PRESENCE_USER_PREFIX + email),
				email, oldM, oldL, oldCellField,
				Long.toString(newMusicId), Integer.toString(newLayer), newCellField,
				Double.toString(x), Double.toString(y), Integer.toString(newCellX), Integer.toString(newCellY),
				LISTENERS_PREFIX, LAYER_LISTENERS_PREFIX, ACTIVE_CELL_PREFIX, ACTIVE_CELLS_PREFIX, USERCOUNT_PREFIX);

		if (result == null || result.isEmpty() || "STALE".equals(result.get(0))) {
			return null; // 미연결/old 불일치
		}
		return result.subList(1, result.size()); // 'OK' 이후 = 만남 목록
	}

	/**
	 * 사용자가 직접 나가거나 소켓이 끊기면 호출한다.
	 * 종료 요청과 현재 접속의 버전이 같을 때만 상태와 주변사람 구독을 지운다.
	 *
	 * @param email 사용자 이메일
	 * @param epoch 종료할 접속 버전
	 * @return 지운 곡, 위치, 접속 버전. 지운 값이 없으면 빈 목록
	 */
	public List<String> applyLeave(String email, long epoch) {
		return doLeave(email, Long.toString(epoch), "");
	}

	/**
	 * 접속이 만료되면 호출한다.
	 * 다시 연결되지 않았을 때만 상태와 주변사람 구독을 지운다.
	 *
	 * @param email 사용자 이메일
	 * @param sweepTimeMs 만료 확인 시각
	 * @return 지운 곡, 위치, 접속 버전. 지운 값이 없으면 빈 목록
	 */
	public List<String> applyLeaveExpired(String email, long sweepTimeMs) {
		return doLeave(email, "", Long.toString(sweepTimeMs));
	}

	/**
	 * 두 종료 경로를 같은 Redis 스크립트로 처리한다.
	 * @param email 사용자 이메일
	 * @param epoch 직접 종료 시 확인할 접속 버전
	 * @param sweepTime 만료 종료 시 확인할 시각
	 * @return 지운 곡, 위치, 접속 버전. 지운 값이 없으면 빈 목록
	 */
	@SuppressWarnings("unchecked")
	private List<String> doLeave(String email, String epoch, String sweepTime) {
		List<String> keys = List.of(PRESENCE_USER_PREFIX + email, EXPIRY_KEY, NEARBY_META_PREFIX + email);
		List<String> result = redis.execute(presenceLeaveScript, keys,
				email, epoch, sweepTime,
				LISTENERS_PREFIX, LAYER_LISTENERS_PREFIX, ACTIVE_CELL_PREFIX, ACTIVE_CELLS_PREFIX, USERCOUNT_PREFIX,
				NEARBY_SUBSCRIBERS_PREFIX);
		return result != null ? result : List.of();
	}

	/**
	 * 셀 인원수 재검증(usercount-recount.lua). 검증 대상 셀 = active-song:cells:{L}(점유 셀) ∪ usercount 필드(유령 카운트).
	 * SCAN 없이 SET·HKEYS 로만 모은다. 실제값은 layer-listeners 합(usercount 증분과 같은 출처).
	 *
	 * @return 불일치(수정)한 셀 수.
	 */
	public long recount(long layer) {
		Set<String> fields = new LinkedHashSet<>();

		// (1) 점유 셀 — active-song:cells:{layer} (play/join/leave 가 유지, SCAN 대체)
		Set<String> cells = redis.opsForSet().members(ACTIVE_CELLS_PREFIX + layer);
		if (cells != null) {
			fields.addAll(cells);
		}
		// (2) 기존 usercount 필드 — 곡 사라졌지만 남은 유령 카운트도 대상
		Set<Object> uc = redis.opsForHash().keys(USERCOUNT_PREFIX + layer);
		if (uc != null) {
			for (Object f : uc) {
				fields.add(f.toString());
			}
		}
		if (fields.isEmpty()) {
			return 0;
		}

		List<String> args = new ArrayList<>(fields.size() + 3);
		args.add(Long.toString(layer));
		args.add(ACTIVE_CELL_PREFIX);
		args.add(LAYER_LISTENERS_PREFIX);
		args.addAll(fields);

		Long n = redis.execute(usercountRecountScript, List.of(USERCOUNT_PREFIX + layer), args.toArray());
		return n != null ? n : 0L;
	}

	/**
	 * 여러 Redis Set을 한 번의 통신으로 읽는다.
	 * @param keys 읽을 Redis 키
	 * @return 키 순서와 같은 조회 결과
	 */
	private List<Object> readSetsAtOnce(List<String> keys) {
		if (keys.isEmpty()) {
			return List.of();
		}
		byte[][] serializedKeys = keys.stream()
				.map(redis.getStringSerializer()::serialize)
				.toArray(byte[][]::new);
		return redis.executePipelined((RedisCallback<Object>) connection -> {
			for (byte[] key : serializedKeys) {
				connection.setCommands().sMembers(key);
			}
			return null;
		});
	}

	/**
	 * Redis Set 조회 결과를 문자열 목록으로 바꾼다.
	 * @param value Redis 조회 결과
	 * @return 문자열 목록
	 */
	private static Set<String> toStringSet(Object value) {
		if (!(value instanceof Set<?> set)) {
			return Set.of();
		}
		Set<String> result = new LinkedHashSet<>();
		for (Object item : set) {
			if (item != null) {
				result.add(item.toString());
			}
		}
		return result;
	}

	private static Long toLong(Object o) {
		return o == null ? null : Long.valueOf(o.toString());
	}

	private static Integer toInt(Object o) {
		return o == null ? null : Integer.valueOf(o.toString());
	}
}
