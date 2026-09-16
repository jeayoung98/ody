package com.ssafy.backend.realtime.viewport.repository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

import com.ssafy.backend.realtime.geometry.CellGrid.Cell;
import com.ssafy.backend.realtime.geometry.Viewport;
import com.ssafy.backend.realtime.geometry.Viewport.LayerBound;

/** 뷰포트 셀 구독과 현재 화면 정보를 Redis에 저장한다. */
@Repository
@Profile("realtime")
public class ViewportRedisRepository {

	private static final String PRESENCE_USER_PREFIX = "presence:user:"; // 현재 접속 정보
	private static final String CELL_SUBSCRIBERS_PREFIX = "viewport:cell:"; // 셀별 변경 수신자
	private static final String META_PREFIX = "viewport:meta:"; // 사용자별 현재 화면 정보

	private static final Comparator<Cell> CELL_ORDER = Comparator
			.comparingInt(Cell::cellX)
			.thenComparingInt(Cell::cellY);

	private final StringRedisTemplate redis; // Redis 읽기와 쓰기
	private final DefaultRedisScript<Long> replaceScript; // 지켜볼 셀 목록 변경

	/**
	 * 화면 구독 저장소를 만든다.
	 * @param redis Redis 읽기와 쓰기
	 * @param replaceScript 지켜볼 셀을 바꾸는 Lua
	 */
	public ViewportRedisRepository(
			StringRedisTemplate redis,
			@Qualifier("viewportSubscriptionReplaceScript") DefaultRedisScript<Long> replaceScript) {
		this.redis = redis;
		this.replaceScript = replaceScript;
	}

	/**
	 * 현재 화면에서 지켜볼 셀을 새 목록으로 바꾼다.
	 * @param email 사용자 이메일
	 * @param epoch 현재 접속 번호
	 * @param requestSeq 화면 요청 순번
	 * @param viewport 현재 화면 범위
	 * @param cells 새로 구독할 셀
	 * @return 변경 여부와 거부 이유
	 */
	public ReplaceResult replaceSubscriptions(
			String email, long epoch, long requestSeq, Viewport viewport, Set<Cell> cells) {
		String ancestorBounds = serializeBounds(viewport.ancestorBounds());
		String cellKeys = serializeCells(cells);
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
				cellKeys,
				CELL_SUBSCRIBERS_PREFIX);
		return ReplaceResult.from(result);
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
			int layer = Integer.parseInt(value(values, "layer"));
			Viewport viewport = new Viewport(
					layer,
					Double.parseDouble(value(values, "minX")),
					Double.parseDouble(value(values, "maxX")),
					Double.parseDouble(value(values, "minY")),
					Double.parseDouble(value(values, "maxY")),
					deserializeBounds(value(values, "ancestorBounds")));
			viewport.validate();
			return Optional.of(new ViewportMeta(
					Long.parseLong(value(values, "epoch")),
					Long.parseLong(value(values, "requestSeq")),
					viewport,
					deserializeCells(value(values, "cellKeys"))));
		} catch (RuntimeException e) {
			throw new IllegalStateException("저장된 화면 정보가 올바르지 않다", e);
		}
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

	/**
	 * 현재 접속에서 마지막으로 저장한 화면과 지켜보는 셀.
	 *
	 * @param epoch 접속 번호
	 * @param requestSeq 마지막 화면 요청 순번
	 * @param viewport 현재 화면 범위
	 * @param cells 구독 중인 셀
	 */
	public record ViewportMeta(long epoch, long requestSeq, Viewport viewport, Set<Cell> cells) {
	}
}
