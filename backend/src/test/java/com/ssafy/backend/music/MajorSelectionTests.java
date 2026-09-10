package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.service.MajorSelection;

/**
 * A14 부분 (FR-013): 후보 리스트에 youtubeCnt 내림차순 top-k. playCnt 는 순위에 영향 없음.
 * 정확한 후보 집합·k 확정값·동률·누락은 B2/B4 미정이므로 여기서 검증하지 않는다.
 */
class MajorSelectionTests {

	private static final Location ORIGIN = new Location(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

	private static MusicDetail candidate(long id, Integer youtubeCnt, Integer playCnt) {
		return new MusicDetail(id, "mbid-" + id, "title-" + id, "artist", 120.0, 200, "album",
				List.of("K-Pop"), "https://youtu.be/" + id, ORIGIN, playCnt, youtubeCnt);
	}

	@Test
	void selectsTopKByYoutubeCntDescending() {
		// 후보 조회수 300·100·200, k=2 → 300·200 순 (spec A14 예시)
		List<MusicDetail> candidates = List.of(
				candidate(1L, 300, 1),
				candidate(2L, 100, 2),
				candidate(3L, 200, 3));

		List<MusicDetail> selected = MajorSelection.topByYoutubeCnt(candidates, 2);

		assertEquals(2, selected.size());
		assertEquals(300, selected.get(0).youtubeCnt());
		assertEquals(200, selected.get(1).youtubeCnt());
	}

	@Test
	void playCntDoesNotChangeOrder() {
		// playCnt 가 youtubeCnt 와 정반대여도 선정 순서는 youtubeCnt 를 따른다.
		List<MusicDetail> candidates = List.of(
				candidate(1L, 300, 10),
				candidate(2L, 100, 30),
				candidate(3L, 200, 20));

		List<MusicDetail> selected = MajorSelection.topByYoutubeCnt(candidates, 3);

		assertEquals(List.of(1L, 3L, 2L), selected.stream().map(MusicDetail::id).toList());
	}

	@Test
	void missingYoutubeCntIsRejectedRatherThanOrderedArbitrarily() {
		List<MusicDetail> candidates = List.of(candidate(1L, 300, 1), candidate(2L, null, 2));

		assertThrows(IllegalArgumentException.class, () -> MajorSelection.topByYoutubeCnt(candidates, 2));
	}
}
