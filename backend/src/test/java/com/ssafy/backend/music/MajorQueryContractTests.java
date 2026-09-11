package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.dto.MapPoint;
import com.ssafy.backend.music.retrieval.LayerBox;
import com.ssafy.backend.music.retrieval.MajorQuery;

/**
 * 조회 port 계약 타입의 불변식 (T004).
 * 값·표기가 아니라 구조를 검사한다 — 미정 정책(B1 레벨 상한 등)은 여기서 정하지 않는다.
 */
class MajorQueryContractTests {

	private static List<Double> pc16() {
		return Collections.nCopies(16, 0.0);
	}

	@Test
	void topLevelTakesNoAccumulatedRange() {
		MajorQuery q = new MajorQuery(1, List.of(), 1000);

		assertTrue(q.isTopLevel());
		assertEquals(1, q.axisX());
		assertEquals(2, q.axisY());
	}

	@Test
	void level3CarriesTwoPrecedingRanges() {
		MajorQuery q = new MajorQuery(3, List.of(
				new LayerBox(1, -5, -5, 5, 5),
				new LayerBox(2, 0, 0, 3, 3)), 1000);

		assertEquals(5, q.axisX());
		assertEquals(6, q.axisY());
		assertEquals(2, q.accumulated().size());
	}

	/** 누적이 모자라면 후보가 조용히 넓어진다 — FR-008 candidate(N+1) ⊆ candidate(N) 이 깨진다. */
	@Test
	void missingAccumulatedRangeIsRejected() {
		assertThrows(IllegalArgumentException.class,
				() -> new MajorQuery(3, List.of(new LayerBox(1, -5, -5, 5, 5)), 1000));
	}

	@Test
	void layerBoxRejectsInvertedRange() {
		assertThrows(IllegalArgumentException.class, () -> new LayerBox(1, 5, 0, -5, 3));
	}

	@Test
	void layerBoxExposesItsAxisPair() {
		assertEquals(3, new LayerBox(2, 0, 0, 1, 1).axisX());
		assertEquals(4, new LayerBox(2, 0, 0, 1, 1).axisY());
	}

	/** FE draw-map.ts 가 raw modulo 라 음수 genreId 는 drawImage 예외를 낸다. */
	@Test
	void mapPointRejectsNegativeGenreId() {
		assertThrows(IllegalArgumentException.class,
				() -> new MapPoint(1L, pc16(), -1, 0, "t", "a", false));
	}

	@Test
	void mapPointRequiresSixteenCoordinates() {
		assertThrows(IllegalArgumentException.class,
				() -> new MapPoint(1L, Collections.nCopies(8, 0.0), 0, 0, "t", "a", false));
	}
}
