package com.ssafy.backend.music.videoid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
		String result = enricher.resolve(1L, "a", "t", "existing1234", 200);

		assertEquals("existing1234", result);
		verifyNoInteractions(lookupPort, writerPort);
	}

	@Test
	void resolve_looksUpAndSaves_whenMissing() {
		when(lookupPort.lookup("a", "t", 200)).thenReturn(Optional.of("xyz12345678"));

		String result = enricher.resolve(1L, "a", "t", null, 200);

		assertEquals("xyz12345678", result);
		verify(writerPort).save(1L, "xyz12345678");
	}

	@Test
	void resolve_returnsNull_andDoesNotSave_whenLookupFindsNothing() {
		when(lookupPort.lookup("a", "t", null)).thenReturn(Optional.empty());

		String result = enricher.resolve(1L, "a", "t", null, null);

		assertNull(result);
		verifyNoInteractions(writerPort);
	}

	/**
	 * S15P21A405-454 — 재생 불가 판정은 video_id 가 아니라 is_unplayable 에 남긴다.
	 * 예전에는 외부 API 가 video_id 자리에 "none" 을 넣어 줘 그대로 저장됐다.
	 */
	@Test
	void resolve_marksUnplayable_andDoesNotWriteVideoId_whenLookupSaysUnplayable() {
		when(lookupPort.lookup("a", "t", 200)).thenReturn(Optional.of(VideoIds.UNPLAYABLE));

		String result = enricher.resolve(1L, "a", "t", null, 200);

		assertEquals(VideoIds.UNPLAYABLE, result);
		verify(writerPort).markUnplayable(1L);
		verify(writerPort, never()).save(anyLong(), anyString());
	}

	/** 판정이 끝난 곡은 다시 묻지 않는다 — "없음" 과 "아직 모름" 을 가르는 이유가 이것이다. */
	@Test
	void resolve_returnsUnplayable_withoutLookup_whenAlreadyJudged() {
		String result = enricher.resolve(1L, "a", "t", VideoIds.UNPLAYABLE, 200);

		assertEquals(VideoIds.UNPLAYABLE, result);
		verifyNoInteractions(lookupPort, writerPort);
	}

	/** S15P21A405-401 — duration 을 모르면 null 로 그대로 lookupPort 에 넘긴다(생략하지 않는다). */
	@Test
	void resolve_passesNullDuration_whenUnknown() {
		when(lookupPort.lookup("a", "t", null)).thenReturn(Optional.of("xyz12345678"));

		enricher.resolve(1L, "a", "t", null, null);

		verify(lookupPort).lookup("a", "t", null);
	}
}
