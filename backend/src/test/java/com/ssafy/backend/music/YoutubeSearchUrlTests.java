package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** 검색 URL 생성 (data 스펙 18 D12). 규칙 6 상 검색 URL 만 허용된다. */
class YoutubeSearchUrlTests {

	@Test
	void buildsSearchUrl_withArtistThenTitle() {
		assertEquals("https://www.youtube.com/results?search_query=IU+Love+wins+all",
				YoutubeSearchUrl.of("IU", "Love wins all"));
	}

	@Test
	void encodesCharactersThatWouldBreakTheQuery() {
		String url = YoutubeSearchUrl.of("AC/DC", "Rock & Roll #1");

		assertEquals("https://www.youtube.com/results?search_query=AC%2FDC+Rock+%26+Roll+%231", url);
	}

	@Test
	void encodesKorean() {
		assertEquals("https://www.youtube.com/results?search_query=%EC%95%84%EC%9D%B4%EC%9C%A0+%EB%B0%A4%ED%8E%B8%EC%A7%80",
				YoutubeSearchUrl.of("아이유", "밤편지"));
	}

	@Test
	void usesArtistOrTitleAlone_whenTheOtherIsMissing() {
		// 적재 실측상 제목이 빈 문자열인 곡이 3,977개 있다.
		assertEquals("https://www.youtube.com/results?search_query=IU", YoutubeSearchUrl.of("IU", ""));
		assertEquals("https://www.youtube.com/results?search_query=Love", YoutubeSearchUrl.of(null, "Love"));
	}

	@Test
	void returnsNull_whenThereIsNothingToSearch() {
		assertNull(YoutubeSearchUrl.of(null, null));
		assertNull(YoutubeSearchUrl.of("  ", ""));
	}

	@Test
	void neverBuildsWatchOrEmbedLink() {
		String url = YoutubeSearchUrl.of("IU", "Love wins all");

		assertTrue(url.startsWith("https://www.youtube.com/results?search_query="), url);
		assertTrue(!url.contains("/watch") && !url.contains("/embed"), url); // 규칙 6
	}
}
