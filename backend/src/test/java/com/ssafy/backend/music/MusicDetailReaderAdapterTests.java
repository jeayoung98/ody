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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.mapper.MusicDetailMapper;
import com.ssafy.backend.music.detail.MusicDetailReaderAdapter;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.dto.MusicGenreRow;
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

	@Test
	void findNeighbors_readsCoordinateFirst_andPassesItAsBindParameter() {
		// 함정 회귀: 질의 벡터를 서브쿼리로 넘기면 recall 0.0000 이라 반드시 값으로 넘겨야 한다.
		when(mapper.findLocationText(7L)).thenReturn("[0.1,-0.3]");
		when(mapper.findNearest(anyLong(), anyString(), anyInt())).thenReturn(List.of());

		adapter.findNeighbors(7L, 10);

		verify(mapper).findLocationText(7L);
		verify(mapper).findNearest(7L, "[0.1,-0.3]", 10);
	}

	@Test
	void findNeighbors_returnsEmpty_whenTrackHasNoCoordinate() {
		when(mapper.findLocationText(anyLong())).thenReturn(null);

		assertTrue(adapter.findNeighbors(404L, 10).isEmpty());
		verify(mapper, never()).findNearest(anyLong(), anyString(), anyInt());
	}

	@Test
	void findNeighbors_skipsGenreQuery_whenNoNeighborFound() {
		// 빈 목록으로 장르를 조회하면 IN () 가 되어 SQL 문법 오류다.
		when(mapper.findLocationText(7L)).thenReturn("[0.1]");
		when(mapper.findNearest(anyLong(), anyString(), anyInt())).thenReturn(List.of());

		assertTrue(adapter.findNeighbors(7L, 10).isEmpty());
		verify(mapper, never()).findGenresByMusicIds(anyList());
	}

	@Test
	void findNeighbors_breaksDistanceTiesByIdAscending() {
		// SQL 은 거리 하나로만 정렬한다(HNSW 순서 유지). 동률 정렬은 어댑터 책임.
		MusicDetailRow far = row(1L);
		far.setDistance(0.9);
		MusicDetailRow tiedHighId = row(30L);
		tiedHighId.setDistance(0.1);
		MusicDetailRow tiedLowId = row(20L);
		tiedLowId.setDistance(0.1);
		when(mapper.findLocationText(7L)).thenReturn("[0.1]");
		when(mapper.findNearest(anyLong(), anyString(), anyInt()))
				.thenReturn(List.of(far, tiedHighId, tiedLowId));
		when(mapper.findGenresByMusicIds(anyList())).thenReturn(List.of());

		List<NeighborTrack> neighbors = adapter.findNeighbors(7L, 10);

		assertEquals(List.of(20L, 30L, 1L), neighbors.stream().map(n -> n.music().id()).toList());
		assertEquals(0.1, neighbors.get(0).distance());
	}

	@Test
	void findNeighbors_groupsGenresPerTrack() {
		MusicDetailRow first = row(1L);
		first.setDistance(0.1);
		MusicDetailRow second = row(2L);
		second.setDistance(0.2);
		when(mapper.findLocationText(7L)).thenReturn("[0.1]");
		when(mapper.findNearest(anyLong(), anyString(), anyInt())).thenReturn(List.of(first, second));
		when(mapper.findGenresByMusicIds(List.of(1L, 2L)))
				.thenReturn(List.of(genreRow(1L, "electronic"), genreRow(1L, "rock")));

		List<NeighborTrack> neighbors = adapter.findNeighbors(7L, 10);

		assertEquals(2, neighbors.size());
		assertEquals(List.of("electronic", "rock"), neighbors.get(0).music().genres());
		assertEquals(List.of(), neighbors.get(1).music().genres());
	}

	@Test
	void findLocationsByIds_readsInOneRoundTrip_andSkipsMissingIds() { // Q18, Q19
		MusicDetailRow found = row(1L);
		found.setPc1(0.5);
		found.setPc16(-0.25);
		when(mapper.findLocationsByIds(List.of(1L, 2L, 3L))).thenReturn(List.of(found));

		Map<Long, Location> locations = adapter.findLocationsByIds(List.of(1L, 2L, 3L));

		verify(mapper, times(1)).findLocationsByIds(anyList());
		// 없는 곡(과 좌표 NULL 인 곡)은 키가 빠진다 — 0 으로 채우면 그 곡이 원점에 찍혀 모양이 달라진다.
		assertEquals(Set.of(1L), locations.keySet());
		assertEquals(0.5, locations.get(1L).pc1());
		assertEquals(-0.25, locations.get(1L).pc16());
		verify(mapper, never()).findGenresByMusicIds(anyList()); // 배치에 장르는 필요 없다
	}

	@Test
	void findLocationsByIds_doesNotQuery_whenNothingRequested() { // Q18 (IN () 는 문법 오류)
		assertTrue(adapter.findLocationsByIds(List.of()).isEmpty());

		verify(mapper, never()).findLocationsByIds(anyList());
	}

	@Test
	void findDetailsByIds_readsInOneRoundTrip_andAttachesGenres() { // US2 (FR-011)
		when(mapper.findByIds(List.of(1L, 2L))).thenReturn(List.of(row(2L), row(1L))); // IN 은 순서를 보존하지 않는다
		when(mapper.findGenresByMusicIds(anyList())).thenReturn(List.of(genreRow(1L, "rock")));

		List<MusicDetail> details = adapter.findDetailsByIds(List.of(1L, 2L));

		verify(mapper, times(1)).findByIds(anyList());
		verify(mapper, never()).findById(anyLong()); // 곡당 왕복으로 돌아가지 않았는지
		assertEquals(2, details.size());
		// 순서는 보장하지 않는다 — 호출자(PlaylistService)가 재조립한다
		assertEquals(List.of("rock"),
				details.stream().filter(d -> d.id() == 1L).findFirst().orElseThrow().genres());
	}

	@Test
	void findDetailsByIds_doesNotQuery_whenNothingRequested() {
		assertTrue(adapter.findDetailsByIds(List.of()).isEmpty());

		verify(mapper, never()).findByIds(anyList());
	}
}
