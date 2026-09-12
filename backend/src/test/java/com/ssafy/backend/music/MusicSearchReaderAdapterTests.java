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

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.dto.MusicSearchRow;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.mapper.MusicSearchMapper;
import com.ssafy.backend.music.search.MusicSearchReader.PageResult;
import com.ssafy.backend.music.search.MusicSearchReaderAdapter;

/**
 * 검색 어댑터 단위 테스트 (매퍼 mock). SQL 자체는 실 DB(T204) 대상이고,
 * 여기서는 어댑터가 지는 책임 — 패턴 조립·offset 계산·좌표 보존·장르 묶기 — 만 본다.
 */
class MusicSearchReaderAdapterTests {

	private final MusicSearchMapper mapper = mock(MusicSearchMapper.class);
	private final MusicSearchReaderAdapter adapter = new MusicSearchReaderAdapter(mapper);

	private static MusicSearchRow row(long id) {
		MusicSearchRow r = new MusicSearchRow();
		r.setId(id);
		r.setTitle("t" + id);
		r.setArtist("a" + id);
		return r;
	}

	@Test
	void search_buildsSubstringPattern_andOffsetFromPageTimesSize() {
		when(mapper.countMatches(anyString())).thenReturn(137L);
		when(mapper.findPage(anyString(), anyString(), anyString(), anyLong(), anyInt(), anyLong())).thenReturn(List.of(row(1L)));
		when(mapper.findGenresByMusicIds(anyList())).thenReturn(List.of());

		PageResult result = adapter.search("IU", 3, 10);

		// q 는 소문자 원문(완전일치용), prefix 는 앞일치용, pattern 은 부분일치용.
		// cap 은 offset + size — 단계별로 그만큼만 잘라도 해당 페이지를 채울 수 있다.
		verify(mapper).findPage("iu", "iu%", "%IU%", 40L, 10, 30L);
		assertEquals(137, result.totalElements());
		assertEquals(1, result.content().size());
	}

	@Test
	void search_escapesLikeWildcards_soPercentIsALiteral() {
		when(mapper.countMatches(anyString())).thenReturn(0L);

		adapter.search("50% _off_", 0, 10);

		ArgumentCaptor<String> pattern = ArgumentCaptor.forClass(String.class);
		verify(mapper).countMatches(pattern.capture());
		assertEquals("%50\\% \\_off\\_%", pattern.getValue());
	}

	@Test
	void search_returnsEmptyWithoutPageQuery_whenNothingMatches() {
		when(mapper.countMatches(anyString())).thenReturn(0L);

		PageResult result = adapter.search("없는곡", 0, 10);

		assertTrue(result.content().isEmpty());
		assertEquals(0, result.totalElements());
		verify(mapper, never()).findPage(anyString(), anyString(), anyString(), anyLong(), anyInt(), anyLong());
	}

	@Test
	void search_keepsTotal_whenPageIsBeyondLastPage() {
		when(mapper.countMatches(anyString())).thenReturn(5L);
		when(mapper.findPage(anyString(), anyString(), anyString(), anyLong(), anyInt(), anyLong())).thenReturn(List.of());

		PageResult result = adapter.search("q", 9, 10);

		assertTrue(result.content().isEmpty());
		assertEquals(5, result.totalElements()); // 빈 페이지지만 총 매칭 수는 유지(FR-002)
		verify(mapper, never()).findGenresByMusicIds(anyList());
	}

	@Test
	void search_copiesStoredCoordinatesVerbatim() {
		MusicSearchRow r = row(7L);
		r.setPc1(0.125);
		r.setPc16(-3.5);
		when(mapper.countMatches(anyString())).thenReturn(1L);
		when(mapper.findPage(anyString(), anyString(), anyString(), anyLong(), anyInt(), anyLong())).thenReturn(List.of(r));
		when(mapper.findGenresByMusicIds(anyList())).thenReturn(List.of());

		MusicSummary summary = adapter.search("q", 0, 10).content().get(0);

		assertEquals(0.125, summary.location().pc1()); // 재계산·반올림 없음 (FR-006)
		assertEquals(-3.5, summary.location().pc16());
	}

	@Test
	void search_groupsGenresPerTrack() {
		MusicSearchRow first = row(1L);
		MusicSearchRow second = row(2L);
		when(mapper.countMatches(anyString())).thenReturn(2L);
		when(mapper.findPage(anyString(), anyString(), anyString(), anyLong(), anyInt(), anyLong())).thenReturn(List.of(first, second));
		when(mapper.findGenresByMusicIds(List.of(1L, 2L))).thenReturn(List.of(
				genreRow(1L, "electronic"),
				genreRow(1L, "rock")));

		List<MusicSummary> content = adapter.search("q", 0, 10).content();

		assertEquals(List.of("electronic", "rock"), content.get(0).genres());
		assertEquals(List.of(), content.get(1).genres()); // 장르 링크 없는 곡
		assertEquals(2, content.size());
	}

	private static MusicGenreRow genreRow(long musicId, String name) {
		MusicGenreRow g = new MusicGenreRow();
		g.setMusicId(musicId);
		g.setName(name);
		return g;
	}
}
