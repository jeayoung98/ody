package com.ssafy.backend.music.videoid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * videoId 실시간 조회·저장 단위 테스트 (S15P21A405-312, 프로토타입).
 * lookup/writer port 는 mock 이고, 검색·상세·주변·경로 네 어댑터가 이 하나를 공유한다.
 */
class VideoIdEnricherTests {

	private final VideoIdLookupPort lookupPort = mock(VideoIdLookupPort.class);
	private final VideoIdWriterPort writerPort = mock(VideoIdWriterPort.class);
	private final VideoIdEnricher enricher = new VideoIdEnricher(lookupPort, writerPort);

	@Test
	void resolve_returnsExisting_withoutCallingLookupOrWriter() {
		String result = enricher.resolve(1L, "a", "t", "existing1234");

		assertEquals("existing1234", result);
		verifyNoInteractions(lookupPort, writerPort);
	}

	@Test
	void resolve_looksUpAndSaves_whenMissing() {
		when(lookupPort.lookup("a", "t")).thenReturn(Optional.of("xyz12345678"));

		String result = enricher.resolve(1L, "a", "t", null);

		assertEquals("xyz12345678", result);
		verify(writerPort).save(1L, "xyz12345678");
	}

	@Test
	void resolve_returnsNull_andDoesNotSave_whenLookupFindsNothing() {
		when(lookupPort.lookup("a", "t")).thenReturn(Optional.empty());

		String result = enricher.resolve(1L, "a", "t", null);

		assertNull(result);
		verifyNoInteractions(writerPort);
	}
}
