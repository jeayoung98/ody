package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.mapper.MusicDetailMapper;
import com.ssafy.backend.music.detail.MusicDetailReaderAdapter;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.NeighborTrack;

/**
 * 상세·주변곡 어댑터 단위 테스트 (매퍼 mock). SQL 자체는 실 DB(T205) 대상이고,
 * 여기서는 어댑터가 지는 책임 — 질의 벡터 전달 방식·자기 제외·동률 tie-break·조립 — 만 본다.
 */
class MusicDetailReaderAdapterTests {

	private final MusicDetailMapper mapper = mock(MusicDetailMapper.class);
	private final MusicDetailReaderAdapter adapter = new MusicDetailReaderAdapter(mapper);

	private static MusicDetailRow row(long id) {
		MusicDetailRow r = new MusicDetailRow();
		r.setId(id);
		r.setTitle("t" + id);
		r.setArtist("a" + id);
		return r;
	}

	private static MusicGenreRow genreRow(long musicId, String name) {
		MusicGenreRow g = new MusicGenreRow();
		g.setMusicId(musicId);
		g.setName(name);
		return g;
	}

	@Test
	void findDetail_returnsEmpty_whenTrackMissing() {
		when(mapper.findById(anyLong())).thenReturn(null);

		assertTrue(adapter.findDetail(404L).isEmpty()); // 서비스가 MUSIC_NOT_FOUND 로 바꾼다
		verify(mapper, never()).findGenresByMusicIds(anyList());
	}

	@Test
	void findDetail_assemblesExtraFields_andCopiesCoordinatesVerbatim() {
		MusicDetailRow r = row(7L);
		r.setMbid("2c1f-...");
		r.setBpm(128.5);
		r.setDuration(215);
		r.setPlayCnt(42);
		r.setYoutubeCnt(3);
		r.setPc1(0.125);
		r.setPc16(-3.5);
		when(mapper.findById(7L)).thenReturn(r);
		when(mapper.findGenresByMusicIds(List.of(7L))).thenReturn(List.of(genreRow(7L, "rock")));

		MusicDetail detail = adapter.findDetail(7L).orElseThrow();

		assertEquals("2c1f-...", detail.mbid());
		assertEquals(128.5, detail.bpm());
		assertEquals(215, detail.duration());
		assertEquals(42, detail.playCnt());
		assertEquals(3, detail.youtubeCnt());
		assertEquals(List.of("rock"), detail.genres());
		assertEquals(0.125, detail.location().pc1()); // 재계산·반올림 없음 (FR-006)
		assertEquals(-3.5, detail.location().pc16());
		assertNull(detail.album()); // 적재 결과상 전 행 NULL
	}

	/**
	 * 이웃 선정은 2026-09-13(D-003)에 {@code NeighborSelection} 으로 옮겼다 — 주변 탐색과 곡 상세가 같은
	 * 규칙을 써야 해서다(005 FR-023). 여기 있던 정렬·자기 제외·빈 결과 테스트는 그쪽으로 갔고,
	 * 어댑터에는 <b>확정된 곡의 상세를 채우는 책임</b>만 남았다.
	 */
	@Test
	void findSummariesByMbids_groupsGenresPerTrack() {
		when(mapper.findByMbids(List.of("m1", "m2"))).thenReturn(List.of(row(1L), row(2L)));
		when(mapper.findGenresByMusicIds(List.of(1L, 2L))).thenReturn(List.of(
				genreRow(1L, "K-Pop"), genreRow(1L, "Ballad"), genreRow(2L, "Rock")));

		List<MusicSummary> out = adapter.findSummariesByMbids(List.of("m1", "m2"));

		assertEquals(2, out.size());
		assertEquals(List.of("K-Pop", "Ballad"), out.get(0).genres());
		assertEquals(List.of("Rock"), out.get(1).genres());
	}

	@Test
	void findSummariesByMbids_skipsQueries_whenInputIsEmpty() {
		assertTrue(adapter.findSummariesByMbids(List.of()).isEmpty());

		verify(mapper, never()).findByMbids(anyList());
		verify(mapper, never()).findGenresByMusicIds(anyList());
	}
}
