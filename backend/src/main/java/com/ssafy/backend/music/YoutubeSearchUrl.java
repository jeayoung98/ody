package com.ssafy.backend.music;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * 곡의 YouTube <b>검색</b> URL 을 만든다 (data 스펙 18 D12).
 *
 * <p>{@code music.youtube_url} 은 662만 행 전부 NULL 이고 채울 방법이 없다 — 규칙 6 이 음원
 * 재생·다운로드·임베드를 금지하고 검색 URL 만 허용하며, YouTube Data API 는 하루 100곡 할당량이라
 * 662만 곡이면 66,000일이 걸린다. 그래서 저장하는 값이 아니라 <b>조회 시 만드는 계산 필드</b>이고,
 * 만드는 쪽이 Backend 다(D12).
 *
 * <p>watch 링크나 임베드 URL 을 만들지 않는다(규칙 6).
 */
public final class YoutubeSearchUrl {

	private static final String SEARCH_BASE = "https://www.youtube.com/results?search_query=";

	private YoutubeSearchUrl() {
	}

	/**
	 * @return 검색 URL. 아티스트·제목이 모두 비어 있으면 검색어를 만들 수 없어 {@code null}
	 *         (적재 실측상 제목이 빈 문자열인 곡이 3,977개 있다)
	 */
	public static String of(String artist, String title) {
		String query = (blankToEmpty(artist) + " " + blankToEmpty(title)).trim();
		if (query.isEmpty()) {
			return null;
		}
		return SEARCH_BASE + URLEncoder.encode(query, StandardCharsets.UTF_8);
	}

	private static String blankToEmpty(String value) {
		return value == null ? "" : value.trim();
	}
}
