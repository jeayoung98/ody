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
import com.ssafy.backend.music.search.MusicSearchCondition;
import com.ssafy.backend.music.search.MusicSearchReader;
import com.ssafy.backend.music.search.MusicSearchReader.PageResult;
import com.ssafy.backend.music.service.MusicService;
import com.ssafy.backend.music.videoid.VideoIdEnricher;

/**
 * 검색 서비스 조립 단위 테스트 (port mock). 순서 보존·hasNext 전달·youtubeUrl null 유지·size 10 전달.
 */
class MusicSearchServiceTests {

	private static final Location LOC =
			new Location(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

	private final MusicSearchReader reader = mock(MusicSearchReader.class);
	private final MusicDetailReader detail = mock(MusicDetailReader.class);
	private final MusicService service = new MusicService(Optional.of(reader), Optional.of(detail), Optional.empty(),
			org.mockito.Mockito.mock(com.ssafy.backend.music.service.NearbyService.class), mock(VideoIdEnricher.class));

	@Test
	void search_passesConditionAndSize10_assemblesPage() {
		MusicSearchCondition condition = new MusicSearchCondition("  IU  ", null, null);
		when(reader.search(condition, 0, 10)).thenReturn(new PageResult(
				List.of(new MusicSummary(1L, "A", "IU", "al", List.of("K-Pop"), "https://y/1", null, LOC)),
				true));

		PageResponse<MusicSummary> r = service.search(condition, 0);

		verify(reader).search(condition, 0, 10);
		assertEquals(0, r.page());
		assertEquals(10, r.size());
		assertTrue(r.hasNext()); // 총 개수는 담지 않는다 (S15P21A405-255)
	}

	@Test
	void search_preservesReaderOrder() {
		MusicSearchCondition condition = new MusicSearchCondition("q", null, null);
		when(reader.search(condition, 0, 10)).thenReturn(new PageResult(
				List.of(
						new MusicSummary(1L, "high", "x", "al", List.of(), "https://y/1", null, LOC),
						new MusicSummary(2L, "low", "y", "al", List.of(), "https://y/2", null, LOC)),
				false));

		PageResponse<MusicSummary> r = service.search(condition, 0);

		assertEquals(List.of(1L, 2L), r.content().stream().map(MusicSummary::id).toList());
	}

	@Test
	void search_keepsNullYoutubeUrl() {
		MusicSearchCondition condition = new MusicSearchCondition("q", null, null);
		when(reader.search(condition, 0, 10)).thenReturn(new PageResult(
				List.of(new MusicSummary(9L, "no link", "z", "al", List.of(), null, null, LOC)),
				false));

		PageResponse<MusicSummary> r = service.search(condition, 0);

		assertNull(r.content().get(0).youtubeUrl());
	}

	@Test
	void search_emptyResult_noNext() {
		MusicSearchCondition condition = new MusicSearchCondition(null, null, "Radiohead");
		when(reader.search(condition, 0, 10)).thenReturn(new PageResult(List.of(), false));

		PageResponse<MusicSummary> r = service.search(condition, 0);

		assertTrue(r.content().isEmpty());
		assertFalse(r.hasNext());
	}

	@Test
	void search_passesReaderHasNextThrough() {
		// 페이지 계산을 서비스가 하지 않는다. 어댑터가 한 건 더 떠보고 판단한 값을 그대로 전달한다.
		MusicSearchCondition condition = new MusicSearchCondition(null, "Love", "Lana Del Rey");
		when(reader.search(condition, 13, 10)).thenReturn(new PageResult(
				List.of(new MusicSummary(1L, "t", "a", "al", List.of(), "https://y/1", null, LOC)), false));

		PageResponse<MusicSummary> r = service.search(condition, 13);

		assertFalse(r.hasNext());
	}

	@Test
	void search_noAdapter_throws() {
		MusicService noReader = new MusicService(Optional.empty(), Optional.empty(), Optional.empty(),
				org.mockito.Mockito.mock(com.ssafy.backend.music.service.NearbyService.class), mock(VideoIdEnricher.class));

		MusicSearchCondition condition = new MusicSearchCondition("q", null, null);
		assertThrows(UnsupportedOperationException.class, () -> noReader.search(condition, 0));
	}
}
