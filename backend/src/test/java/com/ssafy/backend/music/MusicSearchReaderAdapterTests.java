package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
		when(mapper.existsMatch(anyString())).thenReturn(true);
		when(mapper.findPage(anyString(), anyString(), anyString(), anyLong(), anyInt(), anyLong())).thenReturn(List.of(row(1L)));
		when(mapper.findGenresByMusicIds(anyList())).thenReturn(List.of());

		PageResult result = adapter.search("IU", 3, 10);

		// q 는 소문자 원문(완전일치용), prefix 는 앞일치용, pattern 은 부분일치용.
		// size+1 을 요청한다 — 초과분이 오면 다음 페이지가 있다는 뜻이다(S15P21A405-255).
		// cap 은 offset + size + 1 — 단계별로 그만큼만 잘라도 그 판단까지 할 수 있다.
		verify(mapper).findPage("iu", "iu%", "%IU%", 41L, 11, 30L);
		assertEquals(1, result.content().size());
	}

	@Test
	void hasNext_isTrue_whenOneMoreRowThanPageSizeCameBack() {
		// 11건을 떠서 11건이 왔다 = 다음 페이지가 있다. 초과분은 응답에서 잘라낸다.
		when(mapper.existsMatch(anyString())).thenReturn(true);
		when(mapper.findPage(anyString(), anyString(), anyString(), anyLong(), anyInt(), anyLong()))
				.thenReturn(java.util.stream.LongStream.rangeClosed(1L, 11L).mapToObj(MusicSearchReaderAdapterTests::row).toList());
		when(mapper.findGenresByMusicIds(anyList())).thenReturn(List.of());

		PageResult result = adapter.search("q", 0, 10);

		assertTrue(result.hasNext());
		assertEquals(10, result.content().size());
		assertEquals(10L, result.content().get(9).id()); // 11번째는 잘려 나갔다
	}

	@Test
	void hasNext_isFalse_whenPageIsNotFull() {
		when(mapper.existsMatch(anyString())).thenReturn(true);
		when(mapper.findPage(anyString(), anyString(), anyString(), anyLong(), anyInt(), anyLong()))
				.thenReturn(List.of(row(1L), row(2L)));
		when(mapper.findGenresByMusicIds(anyList())).thenReturn(List.of());

		PageResult result = adapter.search("q", 0, 10);

		assertFalse(result.hasNext());
		assertEquals(2, result.content().size());
	}

	@Test
	void search_escapesLikeWildcards_soPercentIsALiteral() {
		when(mapper.existsMatch(anyString())).thenReturn(false);

		adapter.search("50% _off_", 0, 10);

		ArgumentCaptor<String> pattern = ArgumentCaptor.forClass(String.class);
		verify(mapper).existsMatch(pattern.capture());
		assertEquals("%50\\% \\_off\\_%", pattern.getValue());
	}

	@Test
	void search_returnsEmptyWithoutPageQuery_whenNothingMatches() {
		// 방패다. 0건일 때 5단계 질의를 돌리면 각 단계가 조기 종료에 실패해 풀스캔을 다섯 번 한다.
		when(mapper.existsMatch(anyString())).thenReturn(false);

		PageResult result = adapter.search("없는곡", 0, 10);

		assertTrue(result.content().isEmpty());
		assertFalse(result.hasNext());
		verify(mapper, never()).findPage(anyString(), anyString(), anyString(), anyLong(), anyInt(), anyLong());
	}

	@Test
	void search_returnsEmptyPage_whenPageIsBeyondLastPage() {
		when(mapper.existsMatch(anyString())).thenReturn(true);
		when(mapper.findPage(anyString(), anyString(), anyString(), anyLong(), anyInt(), anyLong())).thenReturn(List.of());

		PageResult result = adapter.search("q", 9, 10);

		assertTrue(result.content().isEmpty()); // 오류가 아니라 빈 목록이다(FR-002)
		assertFalse(result.hasNext());
		verify(mapper, never()).findGenresByMusicIds(anyList());
	}

	@Test
	void search_copiesStoredCoordinatesVerbatim() {
		MusicSearchRow r = row(7L);
		r.setPc1(0.125);
		r.setPc16(-3.5);
		when(mapper.existsMatch(anyString())).thenReturn(true);
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
		when(mapper.existsMatch(anyString())).thenReturn(true);
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
