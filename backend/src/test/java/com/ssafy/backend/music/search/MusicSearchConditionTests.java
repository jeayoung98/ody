package com.ssafy.backend.music.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;

class MusicSearchConditionTests {

	@Test
	void acceptsAndTrimsSupportedCombinations() {
		MusicSearchCondition integrated = new MusicSearchCondition("  Love  ", null, null);
		MusicSearchCondition artist = new MusicSearchCondition(null, null, "  Radiohead  ");
		MusicSearchCondition combined = new MusicSearchCondition(null, "  Creep  ", "  Radiohead  ");

		assertEquals("Love", integrated.query());
		assertEquals("Radiohead", artist.artist());
		assertNull(artist.music());
		assertEquals("Creep", combined.music());
		assertEquals("Radiohead", combined.artist());
	}

	@Test
	void rejectsMissingBlankAndUnsupportedCombinations() {
		assertInvalid(null, null, null);
		assertInvalid("   ", null, null);
		assertInvalid(null, "Love", null);
		assertInvalid("Love", null, "IU");
		assertInvalid("Love", "Love", "IU");
		assertInvalid(null, " ", "IU");
		assertInvalid(null, null, " ");
	}

	private static void assertInvalid(String query, String music, String artist) {
		CustomException error = assertThrows(CustomException.class,
				() -> new MusicSearchCondition(query, music, artist));
		assertEquals(GlobalErrorCode.INVALID_INPUT, error.getErrorCode());
	}
}
