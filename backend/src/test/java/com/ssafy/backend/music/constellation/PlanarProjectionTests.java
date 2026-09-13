package com.ssafy.backend.music.constellation;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.constellation.PlanarProjection.Point;

/**
 * 투영 단위 테스트 (quickstart Q1~Q8). Spring·DB 없이 계산만 본다.
 *
 * 핵심은 결정성이다 — 같은 곡 집합이면 누가 언제 불러도 같은 좌표여야 별자리가 "그 플리의 모양" 이 된다.
 */
class PlanarProjectionTests {

	/** 곡마다 다른, 그러나 매번 같은 16차원 좌표. */
	private static double[] coords(long id) {
		double[] pc = new double[PlanarProjection.DIMS];
		for (int d = 0; d < pc.length; d++) {
			pc[d] = Math.sin(id * 1.7 + d * 0.3) * (1 + d % 4);
		}
		return pc;
	}

	private static Map<Long, double[]> sample(long... ids) {
		Map<Long, double[]> map = new LinkedHashMap<>();
		for (long id : ids) {
			map.put(id, coords(id));
		}
		return map;
	}

	/** 한 차원(index 2)에서만 값이 다른 집합. 주축이 e2 로 고정돼 부호 규약을 눈으로 검증할 수 있다. */
	private static Map<Long, double[]> alongThirdAxis(Map<Long, Double> values) {
		Map<Long, double[]> map = new LinkedHashMap<>();
		values.forEach((id, value) -> {
			double[] pc = new double[PlanarProjection.DIMS];
			pc[2] = value;
			map.put(id, pc);
		});
		return map;
	}

	@Test
	void sameSet_projectsToIdenticalCoordinates_everyTime() { // Q1 (FR-004)
		Map<Long, Point> first = PlanarProjection.project(sample(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
		Map<Long, Point> second = PlanarProjection.project(sample(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));

		assertEquals(first, second); // record equals 는 double 비트 비교다
	}

	@Test
	void inputOrder_doesNotChangeCoordinates() { // Q2 (FR-005)
		Map<Long, Point> ascending = PlanarProjection.project(sample(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
		Map<Long, Point> descending = PlanarProjection.project(sample(10, 9, 8, 7, 6, 5, 4, 3, 2, 1));
		Map<Long, Point> shuffled = PlanarProjection.project(sample(7, 2, 10, 4, 1, 9, 3, 8, 5, 6));

		// 곡별 좌표가 같아야 한다. double 덧셈은 결합법칙이 없어 정렬 없이는 마지막 비트가 갈린다.
		for (Long musicId : ascending.keySet()) {
			assertEquals(ascending.get(musicId), descending.get(musicId), "musicId=" + musicId);
			assertEquals(ascending.get(musicId), shuffled.get(musicId), "musicId=" + musicId);
		}
	}

	@Test
	void coordinates_fillTheBox_withoutDistortingShape() { // Q3 (FR-007)
		Map<Long, Point> layout = PlanarProjection.project(sample(11, 22, 33, 44, 55, 66, 77));

		boolean touchesEdge = false;
		for (Point point : layout.values()) {
			assertTrue(Math.abs(point.x()) <= 1, "x 가 범위를 벗어났다: " + point.x());
			assertTrue(Math.abs(point.y()) <= 1, "y 가 범위를 벗어났다: " + point.y());
			touchesEdge |= Math.abs(point.x()) == 1 || Math.abs(point.y()) == 1;
		}
		assertTrue(touchesEdge, "어느 점도 1 에 닿지 않으면 화면을 꽉 채우지 못한다");
	}

	@Test
	void identicalCoordinates_collapseToOrigin_withoutDividingByZero() { // Q4 (FR-008)
		Map<Long, double[]> same = new LinkedHashMap<>();
		for (long id = 1; id <= 5; id++) {
			same.put(id, coords(42));
		}

		Map<Long, Point> layout = PlanarProjection.project(same);

		assertEquals(5, layout.size());
		layout.values().forEach(point -> assertEquals(new Point(0, 0), point));
	}

	@Test
	void collinearSet_keepsSecondAxisFlat() { // Q5 (Edge)
		Map<Long, Point> layout = PlanarProjection.project(
				alongThirdAxis(new LinkedHashMap<>(Map.of(1L, -3.0, 2L, 0.5, 3L, 4.0))));

		layout.values().forEach(point ->
				assertTrue(Math.abs(point.y()) < 1e-12, "분산이 0 인 축은 0 이어야 한다: " + point.y()));
	}

	@Test
	void twoTracks_landOnOppositeEnds() { // Q6 (Edge)
		Map<Long, Point> layout = PlanarProjection.project(sample(100, 200));

		List<Double> xs = new ArrayList<>();
		layout.values().forEach(point -> {
			xs.add(point.x());
			assertTrue(Math.abs(point.y()) < 1e-12, "두 점은 한 축 위에 선다: " + point.y());
		});
		assertEquals(List.of(-1.0, 1.0), xs.stream().sorted().toList());
	}

	@Test
	void axisSign_followsTheConvention_soShapeNeverFlips() { // Q7 (FR-006)
		// 주축이 e2 로 고정된다. 부호 규약("절댓값 최대 성분을 양수로")대로면 pc3 가 큰 곡이 x 도 크다.
		Map<Long, Double> byThirdAxis = new LinkedHashMap<>();
		byThirdAxis.put(1L, -5.0);
		byThirdAxis.put(2L, 0.0);
		byThirdAxis.put(3L, 5.0);

		Map<Long, Point> layout = PlanarProjection.project(alongThirdAxis(byThirdAxis));

		assertEquals(-1.0, layout.get(1L).x());
		assertEquals(0.0, layout.get(2L).x());
		assertEquals(1.0, layout.get(3L).x());
	}

	@Test
	void inputArrays_areNotModified() { // Q8 (FR-002)
		Map<Long, double[]> input = sample(1, 2, 3);
		Map<Long, double[]> untouched = sample(1, 2, 3);

		PlanarProjection.project(input);

		input.forEach((musicId, pc) ->
				assertArrayEquals(untouched.get(musicId), pc, "입력 좌표를 변형했다: musicId=" + musicId));
	}
}
