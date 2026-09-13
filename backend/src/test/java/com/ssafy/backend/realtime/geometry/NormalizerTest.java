package com.ssafy.backend.realtime.geometry;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Normalizer 순수 계산 검증 (spec FR-031, quickstart §2).
 * 프레임워크·Redis 불필요 — 로직 붕괴를 단언 하나로 잡는다.
 */
class NormalizerTest {

	private static final double EPS = 1e-9;
	private static final int GRID = 16;

	@Test
	@DisplayName("normalize: pc=min → 0, pc=max → 1, 중앙 → 0.5")
	void normalizeEndsAndMiddle() {
		assertEquals(0.0, Normalizer.normalize(-10.0, -10.0, 10.0), EPS);
		assertEquals(1.0, Normalizer.normalize(10.0, -10.0, 10.0), EPS);
		assertEquals(0.5, Normalizer.normalize(0.0, -10.0, 10.0), EPS);
	}

	@Test
	@DisplayName("normalize: 범위 밖이면 음수/1초과 (클램프 안 함)")
	void normalizeOutOfRange() {
		assertEquals(-0.05, Normalizer.normalize(-11.0, -10.0, 10.0), EPS); // min 아래
		assertEquals(1.05, Normalizer.normalize(11.0, -10.0, 10.0), EPS);   // max 위
	}

	@Test
	@DisplayName("normalize: 퇴화 축(max<=min)은 0.5 방어")
	void normalizeDegenerate() {
		assertEquals(0.5, Normalizer.normalize(3.0, 5.0, 5.0), EPS);
		assertEquals(0.5, Normalizer.normalize(3.0, 5.0, 4.0), EPS);
	}

	@Test
	@DisplayName("cell: 시작 0, 끝은 grid-1 로 클램프, 중앙")
	void cellEndsAndMiddle() {
		assertEquals(0, Normalizer.cell(0.0, GRID));
		assertEquals(GRID - 1, Normalizer.cell(1.0, GRID)); // floor(16)=16 → 15 클램프
		assertEquals(8, Normalizer.cell(0.5, GRID));        // floor(8.0)=8
	}

	@Test
	@DisplayName("cell: 범위 밖 클램프 — 음수→0, 1초과→grid-1")
	void cellClamp() {
		assertEquals(0, Normalizer.cell(-0.3, GRID));       // floor(-4.8)=-5 → 0
		assertEquals(0, Normalizer.cell(-0.001, GRID));     // 경계 미세 음수 → 0
		assertEquals(GRID - 1, Normalizer.cell(1.5, GRID)); // floor(24)=24 → 15
	}

	@Test
	@DisplayName("cell: 각 1/16 구간이 올바른 셀에 들어간다")
	void cellBuckets() {
		assertEquals(0, Normalizer.cell(0.00, GRID));
		assertEquals(0, Normalizer.cell(0.06, GRID)); // 0.96 → 0
		assertEquals(1, Normalizer.cell(0.0625, GRID)); // 정확히 1/16 → 1.0 → 1
		assertEquals(7, Normalizer.cell(0.49, GRID));
		assertEquals(15, Normalizer.cell(0.99, GRID));
	}
}
