package com.ssafy.backend.music;

import static java.util.Objects.requireNonNullElse;

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

	/**
	 * {@code videoId} 적재 전이라는 뜻 (S15P21A405-57, spec 006).
	 *
	 * <p>값은 {@code null} 이지만 이름을 붙였다. 응답에 {@code videoId} 자리는 있으나 아직 채울
	 * 저장소가 없는 상태라, 그냥 {@code null} 을 적으면 "값이 없는 곡"인지 "기능이 아직 없는 것"인지
	 * 읽는 사람이 구분할 수 없다. 적재가 붙으면 이 상수를 쓰는 자리가 곧 교체 지점이다.
	 *
	 * <p>확보 조건은 spec 006 FR-006 이다 — 길이 ±3초(공식 채널 ±30초) 일치 + {@code embeddable}.
	 * 조건을 못 넘긴 곡은 확보 후에도 {@code null} 이며, 그건 정상 상태다(FR-007).
	 */
	public static final String VIDEO_ID_NOT_LOADED = null;

	private YoutubeSearchUrl() {
	}

	/**
	 * @return 검색 URL. 아티스트·제목이 모두 비어 있으면 검색어를 만들 수 없어 {@code null}
	 *         (적재 실측상 제목이 빈 문자열인 곡이 3,977개 있다)
	 */
	public static String of(String artist, String title) {
		String query = (requireNonNullElse(artist, "") + " " + requireNonNullElse(title, "")).trim();
		if (query.isEmpty()) {
			return null;
		}
		return SEARCH_BASE + URLEncoder.encode(query, StandardCharsets.UTF_8);
	}
}
