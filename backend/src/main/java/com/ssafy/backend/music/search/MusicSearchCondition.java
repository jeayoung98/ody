package com.ssafy.backend.music.search;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;

/** 통합 검색 또는 아티스트 필터 검색의 허용된 조건 조합. */
public record MusicSearchCondition(String query, String music, String artist) {

	public MusicSearchCondition {
		query = normalize(query);
		music = normalize(music);
		artist = normalize(artist);

		boolean integrated = query != null && music == null && artist == null;
		boolean filtered = query == null && artist != null;
		if (!integrated && !filtered) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
	}

	public boolean isIntegrated() {
		return query != null;
	}

	public String mode() {
		return isIntegrated() ? "all" : music == null ? "artist" : "combined";
	}

	private static String normalize(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		if (trimmed.isEmpty()) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		return trimmed;
	}
}
