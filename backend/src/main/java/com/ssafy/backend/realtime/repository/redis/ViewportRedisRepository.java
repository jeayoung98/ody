package com.ssafy.backend.realtime.repository.redis;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.geometry.ViewportRange.LayerBound;
import com.ssafy.backend.realtime.dto.viewport.ViewportMode;

/** 뷰포트 셀 구독과 현재 화면 정보를 Redis에 저장한다. */
@Repository
@Profile("realtime")
public class ViewportRedisRepository {

	private static final String PRESENCE_USER_PREFIX = "presence:user:"; // 현재 접속 정보
	private static final String CELL_SUBSCRIBERS_PREFIX = "viewport:cell:"; // 셀별 변경 수신자
	private static final String META_PREFIX = "viewport:meta:"; // 사용자별 현재 화면 정보
	private static final String CLUSTERED_SUBSCRIBERS_PREFIX = "viewport:clustered:"; // 셀별 인원수 화면 사용자
	private static final String USERCOUNT_PREFIX = "cell:usercount:"; // 기본 셀별 사용자 수

	private static final Comparator<Cell> CELL_ORDER = Comparator
			.comparingInt(Cell::cellX)
			.thenComparingInt(Cell::cellY);

	private final StringRedisTemplate redis; // Redis 읽기와 쓰기
	private final DefaultRedisScript<Long> replaceScript; // 지켜볼 셀 목록 변경
	private final DefaultRedisScript<Long> closeScript; // 마지막 화면 구독 닫기

	/**
	 * 화면 구독 저장소를 만든다.
	 * @param redis Redis 읽기와 쓰기
	 * @param replaceScript 지켜볼 셀을 바꾸는 Lua
	 * @param closeScript 마지막 화면 구독을 닫는 Lua
	 */
	public ViewportRedisRepository(
			StringRedisTemplate redis,
			@Qualifier("viewportSubscriptionReplaceScript") DefaultRedisScript<Long> replaceScript,
			@Qualifier("viewportSubscriptionCloseScript") DefaultRedisScript<Long> closeScript) {
		this.redis = redis;
		this.replaceScript = replaceScript;
		this.closeScript = closeScript;
	}

	/**
	 * 현재 화면에서 지켜볼 셀을 새 목록으로 바꾼다.
	 * @param email 사용자 이메일
	 * @param epoch 현재 접속 번호
	 * @param requestSeq 화면 요청 순번
	 * @param viewport 현재 화면 범위
	 * @param mode 새 화면 표시 방식
	 * @param cells 개별 사용자 방식에서 지켜볼 셀
	 * @return 변경 여부와 거부 이유
	 */
	public ReplaceResult replaceSubscriptions(
			String email, long epoch, long requestSeq, ViewportRange viewport,
			ViewportMode mode, Set<Cell> cells) {
		String ancestorBounds = serializeBounds(viewport.ancestorBounds());
		String cellKeys = mode == ViewportMode.INDIVIDUAL ? serializeCells(cells) : "";
		Long result = redis.execute(replaceScript,
				List.of(PRESENCE_USER_PREFIX + email, META_PREFIX + email),
				email,
				Long.toString(epoch),
				Long.toString(requestSeq),
				Integer.toString(viewport.layer()),
				Double.toString(viewport.minX()),
				Double.toString(viewport.maxX()),
				Double.toString(viewport.minY()),
				Double.toString(viewport.maxY()),
				ancestorBounds,
				mode.name(),
				cellKeys,
				CELL_SUBSCRIBERS_PREFIX,
				CLUSTERED_SUBSCRIBERS_PREFIX);
		return ReplaceResult.from(result);
	}

	/**
	 * 현재 접속에서 마지막으로 연 화면의 구독을 닫는다.
	 *
	 * @param email 사용자 이메일
	 * @param epoch 현재 접속 번호
	 * @param requestSeq 마지막 화면 요청 순번
	 * @return 닫기 결과
	 */
	public CloseResult closeCurrentScreen(String email, long epoch, long requestSeq) {
		Long result = redis.execute(closeScript,
				List.of(PRESENCE_USER_PREFIX + email, META_PREFIX + email),
				email,
				Long.toString(epoch),
				Long.toString(requestSeq),
				CELL_SUBSCRIBERS_PREFIX,
				CLUSTERED_SUBSCRIBERS_PREFIX);
		return CloseResult.from(result);
	}

	/**
	 * 사용자가 마지막으로 보낸 화면 정보를 읽는다.
	 * @param email 사용자 이메일
	 * @return 저장된 화면 정보. 없으면 empty
	 */
	public Optional<ViewportMeta> findMeta(String email) {
		Map<Object, Object> values = redis.opsForHash().entries(META_PREFIX + email);
		if (values.isEmpty()) {
			return Optional.empty();
		}
		try {
			return Optional.of(toMeta(values));
		} catch (RuntimeException e) {
			throw new IllegalStateException("저장된 화면 정보가 올바르지 않다", e);
		}
	}

	/**
	 * 이전 셀과 새 셀을 지켜보는 사용자를 한 번에 읽는다.
	 * 같은 셀이면 한 번만 읽는다.
	 *
	 * @param oldLayer 이전 레이어
	 * @param oldCell 이전 셀
	 * @param newLayer 새 레이어
	 * @param newCell 새 셀
	 * @return 두 셀을 지켜보는 사용자
	 */
	public Set<String> findUsersWatchingCells(
			Integer oldLayer, String oldCell,
			Integer newLayer, String newCell) {
		Set<String> keys = new LinkedHashSet<>();
		addCellKey(keys, oldLayer, oldCell);
		addCellKey(keys, newLayer, newCell);
		if (keys.isEmpty()) {
			return Set.of();
		}

		Set<String> subscribers = new LinkedHashSet<>();
		for (Object value : readSetsAtOnce(List.copyOf(keys))) {
			subscribers.addAll(toStringSet(value));
		}
		return Set.copyOf(subscribers);
	}

	/**
	 * 레이어별 셀 인원수 화면 사용자를 한 번에 읽는다.
	 *
	 * @param maxLayer 마지막 레이어 번호
	 * @return 레이어별 사용자 이메일
	 */
	public Map<Integer, Set<String>> findCellCountUsersByLayer(int maxLayer) {
		if (maxLayer < 1) {
			return Map.of();
		}
		List<String> keys = new ArrayList<>(maxLayer);
		for (int layer = 1; layer <= maxLayer; layer++) {
			keys.add(CLUSTERED_SUBSCRIBERS_PREFIX + layer);
		}
		List<Object> values = readSetsAtOnce(keys);
		Map<Integer, Set<String>> result = new LinkedHashMap<>();
		for (int layer = 1; layer <= maxLayer; layer++) {
			Set<String> emails = toStringSet(values.get(layer - 1));
			if (!emails.isEmpty()) {
				result.put(layer, emails);
			}
		}
		return result;
	}

	/**
	 * 여러 사용자의 현재 화면 정보를 한 번에 읽는다.
	 *
	 * @param emails 사용자 이메일
	 * @return 정상적으로 저장된 사용자별 화면 정보
	 */
	public Map<String, ViewportMeta> findMetaByEmails(Set<String> emails) {
		if (emails.isEmpty()) {
			return Map.of();
		}
		List<String> sortedEmails = emails.stream().sorted().toList();
		List<String> keys = sortedEmails.stream().map(email -> META_PREFIX + email).toList();
		List<Object> values = readHashesAtOnce(keys);
		Map<String, ViewportMeta> result = new LinkedHashMap<>();
		for (int i = 0; i < sortedEmails.size(); i++) {
			Map<Object, Object> fields = toObjectMap(values.get(i));
			if (fields.isEmpty()) {
				continue;
			}
			try {
				result.put(sortedEmails.get(i), toMeta(fields));
			} catch (RuntimeException ignored) {
				// 지워지는 중이거나 깨진 화면 정보는 이번 갱신에서 뺀다.
			}
		}
		return result;
	}

	/**
	 * 기본 셀의 사용자 수를 한 번에 읽는다.
	 * @param layer 현재 레이어
	 * @param cells 확인할 기본 셀
	 * @return 사용자가 있는 셀과 인원수
	 */
	public Map<Cell, Integer> findUserCountsByCell(int layer, List<Cell> cells) {
		if (cells.isEmpty()) {
			return Map.of();
		}
		List<Object> fields = cells.stream()
				.map(cell -> (Object) (cell.cellX() + ":" + cell.cellY()))
				.toList();
		List<Object> values = redis.opsForHash().multiGet(USERCOUNT_PREFIX + layer, fields);

		Map<Cell, Integer> result = new LinkedHashMap<>();
		for (int i = 0; i < cells.size(); i++) {
			Object value = values == null ? null : values.get(i);
			int count = value == null ? 0 : Integer.parseInt(value.toString());
			if (count > 0) {
				result.put(cells.get(i), count);
			}
		}
		return result;
	}

	/**
	 * 이전 화면 목록을 Redis에 저장할 문자열로 바꾼다.
	 * @param bounds 이전 화면 목록
	 * @return Redis에 저장할 값
	 */
	private static String serializeBounds(List<LayerBound> bounds) {
		return bounds.stream()
				.map(bound -> bound.layer() + "|"
						+ bound.minX() + "|" + bound.maxX() + "|"
						+ bound.minY() + "|" + bound.maxY())
				.collect(Collectors.joining(";"));
	}

	/**
	 * Redis 문자열을 이전 화면 목록으로 되돌린다.
	 * @param value Redis에서 읽은 값
	 * @return 이전 화면 목록
	 */
	private static List<LayerBound> deserializeBounds(String value) {
		if (value.isBlank()) {
			return List.of();
		}
		List<LayerBound> bounds = new ArrayList<>();
		for (String item : value.split(";")) {
			String[] fields = item.split("\\|", -1);
			if (fields.length != 5) {
				throw new IllegalArgumentException("이전 화면 형식 오류");
			}
			bounds.add(new LayerBound(
					Integer.parseInt(fields[0]),
					Double.parseDouble(fields[1]), Double.parseDouble(fields[2]),
					Double.parseDouble(fields[3]), Double.parseDouble(fields[4])));
		}
		return List.copyOf(bounds);
	}

	/**
	 * 셀 목록을 정렬해 Redis에 저장할 문자열로 바꾼다.
	 * @param cells 지켜볼 셀 목록
	 * @return Redis에 저장할 값
	 */
	private static String serializeCells(Set<Cell> cells) {
		return cells.stream()
				.sorted(CELL_ORDER)
				.map(cell -> cell.cellX() + ":" + cell.cellY())
				.collect(Collectors.joining(","));
	}

	/**
	 * Redis 문자열을 셀 목록으로 되돌린다.
	 * @param value Redis에서 읽은 값
	 * @return 지켜보는 셀 목록
	 */
	private static Set<Cell> deserializeCells(String value) {
		if (value.isBlank()) {
			return Set.of();
		}
		Set<Cell> cells = new LinkedHashSet<>();
		for (String item : value.split(",")) {
			String[] fields = item.split(":", -1);
			if (fields.length != 2) {
				throw new IllegalArgumentException("셀 형식 오류");
			}
			cells.add(new Cell(Integer.parseInt(fields[0]), Integer.parseInt(fields[1])));
		}
		return Set.copyOf(cells);
	}

	/** 레이어와 셀이 모두 있을 때만 조회할 키를 만든다. */
	private static void addCellKey(Set<String> keys, Integer layer, String cell) {
		if (layer != null && cell != null) {
			keys.add(CELL_SUBSCRIBERS_PREFIX + layer + ":" + cell);
		}
	}

	/** 여러 Redis Set을 한 번에 읽는다. */
	private List<Object> readSetsAtOnce(List<String> keys) {
		byte[][] serializedKeys = serializeKeys(keys);
		return redis.executePipelined((RedisCallback<Object>) connection -> {
			for (byte[] key : serializedKeys) {
				connection.setCommands().sMembers(key);
			}
			return null;
		});
	}

	/** 여러 Redis Hash를 한 번에 읽는다. */
	private List<Object> readHashesAtOnce(List<String> keys) {
		byte[][] serializedKeys = serializeKeys(keys);
		return redis.executePipelined((RedisCallback<Object>) connection -> {
			for (byte[] key : serializedKeys) {
				connection.hashCommands().hGetAll(key);
			}
			return null;
		});
	}

	/** Redis 키 목록을 전송할 값으로 바꾼다. */
	private byte[][] serializeKeys(List<String> keys) {
		return keys.stream()
				.map(redis.getStringSerializer()::serialize)
				.toArray(byte[][]::new);
	}

	/** Redis Set 조회 결과를 문자열 목록으로 바꾼다. */
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
		return Set.copyOf(result);
	}

	/** Redis Hash 조회 결과를 화면 정보 변환용 Map으로 바꾼다. */
	private static Map<Object, Object> toObjectMap(Object value) {
		if (!(value instanceof Map<?, ?> map)) {
			return Map.of();
		}
		Map<Object, Object> result = new LinkedHashMap<>();
		map.forEach(result::put);
		return result;
	}

	/** 저장된 필드를 화면 정보로 바꾼다. */
	private static ViewportMeta toMeta(Map<Object, Object> values) {
		int layer = Integer.parseInt(value(values, "layer"));
		ViewportMode mode = ViewportMode.valueOf(value(values, "mode"));
		ViewportRange viewport = new ViewportRange(
				layer,
				Double.parseDouble(value(values, "minX")),
				Double.parseDouble(value(values, "maxX")),
				Double.parseDouble(value(values, "minY")),
				Double.parseDouble(value(values, "maxY")),
				deserializeBounds(value(values, "ancestorBounds")));
		viewport.validate();
		return new ViewportMeta(
				Long.parseLong(value(values, "epoch")),
				Long.parseLong(value(values, "requestSeq")),
				mode,
				viewport,
				deserializeCells(value(values, "cellKeys")));
	}

	/**
	 * 저장된 화면 정보에서 필요한 값을 꺼낸다.
	 * @param values 저장된 화면 정보
	 * @param key 꺼낼 값의 이름
	 * @return 찾은 값
	 * @throws IllegalArgumentException 값이 없는 경우
	 */
	private static String value(Map<Object, Object> values, String key) {
		Object value = values.get(key);
		if (value == null) {
			throw new IllegalArgumentException("필드 누락: " + key);
		}
		return value.toString();
	}

	/** 화면 구독 변경 결과. */
	public enum ReplaceResult {
		APPLIED,
		OLD_REQUEST,
		STALE_CONNECTION;

		/**
		 * Lua 반환값을 변경 결과로 바꾼다.
		 * @param result Lua 반환값
		 * @return 화면 구독 변경 결과
		 */
		private static ReplaceResult from(Long result) {
			if (result != null && result == 1L) {
				return APPLIED;
			}
			if (result != null && result == 0L) {
				return OLD_REQUEST;
			}
			return STALE_CONNECTION;
		}
	}

	/** 화면 구독 닫기 결과. */
	public enum CloseResult {
		CLOSED,
		OLD_REQUEST,
		STALE_CONNECTION;

		/**
		 * Lua 반환값을 닫기 결과로 바꾼다.
		 *
		 * @param result Lua 반환값
		 * @return 화면 구독 닫기 결과
		 */
		private static CloseResult from(Long result) {
			if (result != null && result == 1L) {
				return CLOSED;
			}
			if (result != null && result == 0L) {
				return OLD_REQUEST;
			}
			return STALE_CONNECTION;
		}
	}

	/**
	 * 현재 접속에서 마지막으로 저장한 화면과 지켜보는 셀.
	 *
	 * @param epoch 접속 번호
	 * @param requestSeq 마지막 화면 요청 순번
	 * @param mode 화면 표시 방식
	 * @param viewport 현재 화면 범위
	 * @param cells 구독 중인 셀
	 */
	public record ViewportMeta(
			long epoch, long requestSeq, ViewportMode mode, ViewportRange viewport, Set<Cell> cells) {
	}
}
