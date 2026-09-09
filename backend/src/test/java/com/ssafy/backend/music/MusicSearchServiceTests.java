package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.PageResponse;
import com.ssafy.backend.music.search.MusicSearchReader;
import com.ssafy.backend.music.search.MusicSearchReader.PageResult;
import com.ssafy.backend.music.service.MusicService;

/**
 * 검색 서비스 조립 단위 테스트 (port mock). 순서 보존·페이지 계산·youtubeUrl null 유지·size 10 전달.
 */
class MusicSearchServiceTests {

	private static final Location LOC =
			new Location(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

	private final MusicSearchReader reader = mock(MusicSearchReader.class);
	private final MusicService service = new MusicService(Optional.of(reader));

	@Test
	void search_trimsQuery_passesSize10_assemblesPage() {
		when(reader.search("IU", 0, 10)).thenReturn(new PageResult(
				List.of(new MusicSummary(1L, "A", "IU", "al", List.of("K-Pop"), "https://y/1", LOC)),
				137));

		PageResponse<MusicSummary> r = service.search("  IU  ", 0);

		verify(reader).search("IU", 0, 10); // trim + 크기 10 고정
		assertEquals(0, r.page());
		assertEquals(10, r.size());
		assertEquals(137, r.totalElements());
		assertEquals(14, r.totalPages()); // ceil(137/10)
		assertTrue(r.hasNext());
	}

	@Test
	void search_preservesReaderOrder() {
		when(reader.search("q", 0, 10)).thenReturn(new PageResult(
				List.of(
						new MusicSummary(1L, "high", "x", "al", List.of(), "https://y/1", LOC),
						new MusicSummary(2L, "low", "y", "al", List.of(), "https://y/2", LOC)),
				2));

		PageResponse<MusicSummary> r = service.search("q", 0);

		assertEquals(List.of(1L, 2L), r.content().stream().map(MusicSummary::id).toList());
	}

	@Test
	void search_keepsNullYoutubeUrl() {
		when(reader.search("q", 0, 10)).thenReturn(new PageResult(
				List.of(new MusicSummary(9L, "no link", "z", "al", List.of(), null, LOC)),
				1));

		PageResponse<MusicSummary> r = service.search("q", 0);

		assertNull(r.content().get(0).youtubeUrl());
	}

	@Test
	void search_emptyResult_zeroPagesNoNext() {
		when(reader.search("q", 0, 10)).thenReturn(new PageResult(List.of(), 0));

		PageResponse<MusicSummary> r = service.search("q", 0);

		assertTrue(r.content().isEmpty());
		assertEquals(0, r.totalPages());
		assertFalse(r.hasNext());
	}

	@Test
	void search_lastPage_hasNextFalse() {
		when(reader.search("q", 13, 10)).thenReturn(new PageResult(
				List.of(new MusicSummary(1L, "t", "a", "al", List.of(), "https://y/1", LOC)), 137));

		PageResponse<MusicSummary> r = service.search("q", 13);

		assertFalse(r.hasNext()); // 14페이지(0~13) 중 마지막
	}

	@Test
	void search_noAdapter_throws() {
		MusicService noReader = new MusicService(Optional.empty());

		assertThrows(UnsupportedOperationException.class, () -> noReader.search("q", 0));
	}
}
