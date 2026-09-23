package com.ssafy.backend.music.constellation;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * 투영 단위 테스트. Spring·DB 없이 계산만 본다.
 *
 * <p>핵심은 둘이다 — <b>결정성</b>(같은 집합이면 누가 언제 불러도 같은 좌표) 과
 * <b>지도 일치</b>(배치의 상대 위치가 pc1/pc2 의 상대 위치와 같다, S15P21A405-595).
 */
class PlanarProjectionTests {

	private static final double EPS = 1e-12;

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

	/** pc1·pc2 만 지정하고 나머지 14축은 곡마다 크게 다른 잡음을 넣는다. 잡음이 배치에 영향을 주면 안 된다. */
	private static Map<Long, double[]> onPlane(Map<Long, double[]> xy) {
		Map<Long, double[]> map = new LinkedHashMap<>();
		xy.forEach((id, p) -> {
			double[] pc = new double[PlanarProjection.DIMS];
			pc[PlanarProjection.AXIS_X] = p[0];
			pc[PlanarProjection.AXIS_Y] = p[1];
			for (int d = 2; d < pc.length; d++) {
				pc[d] = Math.cos(id * 3.1 + d) * 50;   // 다른 축의 큰 분산
			}
			map.put(id, pc);
		});
		return map;
	}

	@Test
	void sameSet_projectsToIdenticalCoordinates_everyTime() {
		Map<Long, PlanarProjection.Point> first = PlanarProjection.project(sample(1, 2, 3, 4, 5));
		Map<Long, PlanarProjection.Point> second = PlanarProjection.project(sample(1, 2, 3, 4, 5));

		assertEquals(first, second);
	}

	@Test
	void inputOrder_doesNotChangeCoordinates() {
		Map<Long, PlanarProjection.Point> forward = PlanarProjection.project(sample(1, 2, 3, 4, 5, 6));
		Map<Long, PlanarProjection.Point> backward = PlanarProjection.project(sample(6, 5, 4, 3, 2, 1));

		assertEquals(forward, backward);
	}

	/** 배치는 pc1/pc2 의 상대 위치를 그대로 옮긴 것이다 — 다른 14축이 아무리 흔들려도. */
	@Test
	void layout_followsPc1Pc2_ignoringOtherAxes() {
		Map<Long, double[]> xy = new LinkedHashMap<>();
		xy.put(1L, new double[] {0, 0});
		xy.put(2L, new double[] {4, 0});     // 오른쪽
		xy.put(3L, new double[] {0, 2});     // 위
		xy.put(4L, new double[] {-4, -2});   // 왼쪽 아래

		Map<Long, PlanarProjection.Point> out = PlanarProjection.project(onPlane(xy));

		// 평균 (0, 0). 최대 절댓값 4 → 배율 1/4.
		assertPoint(out.get(1L), 0.0, 0.0);
		assertPoint(out.get(2L), 1.0, 0.0);
		assertPoint(out.get(3L), 0.0, 0.5);
		assertPoint(out.get(4L), -1.0, -0.5);
	}

	/** 두 축에 같은 배율 — 가로로 긴 집합은 가로로 긴 채 나온다(찌그러지지 않는다). */
	@Test
	void coordinates_fillTheBox_withoutDistortingShape() {
		Map<Long, double[]> xy = new LinkedHashMap<>();
		xy.put(1L, new double[] {-10, -1});
		xy.put(2L, new double[] {10, 1});
		xy.put(3L, new double[] {0, 0});

		Map<Long, PlanarProjection.Point> out = PlanarProjection.project(onPlane(xy));

		double maxAbs = out.values().stream()
				.mapToDouble(p -> Math.max(Math.abs(p.x()), Math.abs(p.y()))).max().orElseThrow();
		assertEquals(1.0, maxAbs, EPS);
		assertPoint(out.get(2L), 1.0, 0.1);   // y 는 x 의 1/10 그대로
	}

	@Test
	void identicalCoordinates_collapseToOrigin_withoutDividingByZero() {
		Map<Long, double[]> map = new LinkedHashMap<>();
		double[] same = coords(42);
		for (long id : List.of(1L, 2L, 3L)) {
			map.put(id, same.clone());
		}

		Map<Long, PlanarProjection.Point> out = PlanarProjection.project(map);

		out.values().forEach(p -> assertPoint(p, 0.0, 0.0));
	}

	@Test
	void twoTracks_landOnOppositeEnds() {
		Map<Long, double[]> xy = new LinkedHashMap<>();
		xy.put(1L, new double[] {3, 7});
		xy.put(2L, new double[] {5, 7});

		Map<Long, PlanarProjection.Point> out = PlanarProjection.project(onPlane(xy));

		assertPoint(out.get(1L), -1.0, 0.0);
		assertPoint(out.get(2L), 1.0, 0.0);
	}

	/** pc1 양수가 오른쪽, pc2 양수가 위 — 지도와 같은 방향이라 뒤집힘이 없다. */
	@Test
	void axisDirection_matchesTheMap() {
		Map<Long, double[]> xy = new LinkedHashMap<>();
		xy.put(1L, new double[] {0, 0});
		xy.put(2L, new double[] {1, 3});

		Map<Long, PlanarProjection.Point> out = PlanarProjection.project(onPlane(xy));

		assertTrue(out.get(2L).x() > out.get(1L).x());
		assertTrue(out.get(2L).y() > out.get(1L).y());
	}

	@Test
	void inputArrays_areNotModified() {
		Map<Long, double[]> input = sample(1, 2, 3);
		Map<Long, double[]> snapshot = new LinkedHashMap<>();
		input.forEach((id, pc) -> snapshot.put(id, pc.clone()));

		PlanarProjection.project(input);

		input.forEach((id, pc) -> assertArrayEquals(snapshot.get(id), pc));
	}

	@Test
	void rejectsWrongDimension() {
		Map<Long, double[]> bad = new LinkedHashMap<>();
		bad.put(1L, new double[] {1, 2});
		bad.put(2L, coords(2));

		assertThrows(IllegalArgumentException.class, () -> PlanarProjection.project(bad));
	}

	@Test
	void emptyInput_returnsEmpty() {
		assertTrue(PlanarProjection.project(Map.of()).isEmpty());
	}

	private static void assertPoint(PlanarProjection.Point p, double x, double y) {
		assertEquals(x, p.x(), EPS, "x");
		assertEquals(y, p.y(), EPS, "y");
	}
}
