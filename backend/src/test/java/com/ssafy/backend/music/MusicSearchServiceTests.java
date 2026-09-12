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

import com.ssafy.backend.music.detail.MusicDetailReader;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.PageResponse;
import com.ssafy.backend.music.search.MusicSearchReader;
import com.ssafy.backend.music.search.MusicSearchReader.PageResult;
import com.ssafy.backend.music.service.MusicService;

/**
 * 검색 서비스 조립 단위 테스트 (port mock). 순서 보존·hasNext 전달·youtubeUrl null 유지·size 10 전달.
 */
class MusicSearchServiceTests {

	private static final Location LOC =
			new Location(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

	private final MusicSearchReader reader = mock(MusicSearchReader.class);
	private final MusicDetailReader detail = mock(MusicDetailReader.class);
	private final MusicService service = new MusicService(Optional.of(reader), Optional.of(detail), Optional.empty());

	@Test
	void search_trimsQuery_passesSize10_assemblesPage() {
		when(reader.search("IU", 0, 10)).thenReturn(new PageResult(
				List.of(new MusicSummary(1L, "A", "IU", "al", List.of("K-Pop"), "https://y/1", LOC)),
				true));

		PageResponse<MusicSummary> r = service.search("  IU  ", 0);

		verify(reader).search("IU", 0, 10); // trim + 크기 10 고정
		assertEquals(0, r.page());
		assertEquals(10, r.size());
		assertTrue(r.hasNext()); // 총 개수는 담지 않는다 (S15P21A405-255)
	}

	@Test
	void search_preservesReaderOrder() {
		when(reader.search("q", 0, 10)).thenReturn(new PageResult(
				List.of(
						new MusicSummary(1L, "high", "x", "al", List.of(), "https://y/1", LOC),
						new MusicSummary(2L, "low", "y", "al", List.of(), "https://y/2", LOC)),
				false));

		PageResponse<MusicSummary> r = service.search("q", 0);

		assertEquals(List.of(1L, 2L), r.content().stream().map(MusicSummary::id).toList());
	}

	@Test
	void search_keepsNullYoutubeUrl() {
		when(reader.search("q", 0, 10)).thenReturn(new PageResult(
				List.of(new MusicSummary(9L, "no link", "z", "al", List.of(), null, LOC)),
				false));

		PageResponse<MusicSummary> r = service.search("q", 0);

		assertNull(r.content().get(0).youtubeUrl());
	}

	@Test
	void search_emptyResult_noNext() {
		when(reader.search("q", 0, 10)).thenReturn(new PageResult(List.of(), false));

		PageResponse<MusicSummary> r = service.search("q", 0);

		assertTrue(r.content().isEmpty());
		assertFalse(r.hasNext());
	}

	@Test
	void search_passesReaderHasNextThrough() {
		// 페이지 계산을 서비스가 하지 않는다. 어댑터가 한 건 더 떠보고 판단한 값을 그대로 전달한다.
		when(reader.search("q", 13, 10)).thenReturn(new PageResult(
				List.of(new MusicSummary(1L, "t", "a", "al", List.of(), "https://y/1", LOC)), false));

		PageResponse<MusicSummary> r = service.search("q", 13);

		assertFalse(r.hasNext());
	}

	@Test
	void search_noAdapter_throws() {
		MusicService noReader = new MusicService(Optional.empty(), Optional.empty(), Optional.empty());

		assertThrows(UnsupportedOperationException.class, () -> noReader.search("q", 0));
	}
}
