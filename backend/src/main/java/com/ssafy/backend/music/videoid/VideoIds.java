package com.ssafy.backend.music.videoid;

/**
 * "찾아봤지만 쓸 만한 영상이 없다" 를 나타내는 값 (S15P21A405-332, S15P21A405-454).
 *
 * <p>저장 계층의 정본은 {@code music.is_unplayable} 이고, 이 문자열은 <b>응답 계약</b>이다 —
 * 프론트가 {@code "none"} / 11자 / {@code null} 셋으로 <b>"없음"과 "아직 모름"</b> 을 가른다
 * (S15P21A405-364). {@code null} 로 뭉개면 재생 불가 곡이 "잠시 후 다시 눌러 주세요" 로 내려가
 * 누를 때마다 재조회가 나간다.
 *
 * <p>플래그와 응답 값을 잇는 번역은 {@link #of} 한 곳이다.
 */
public final class VideoIds {

	/** 재생 불가. {@code null}(미판정) 과 뜻이 다르다 — 다시 조회하지 않는다. */
	public static final String UNPLAYABLE = "none";

	private VideoIds() {
	}

	/**
	 * DB 행을 응답 값으로 바꾼다. 플래그가 서 있으면 {@code video_id} 가 무엇이든 재생 불가다 —
	 * 전환 전에 저장된 행은 {@code 'none'} 을, 이후 행은 {@code NULL} 을 들고 있다.
	 */
	public static String of(boolean unplayable, String videoId) {
		return unplayable ? UNPLAYABLE : videoId;
	}
}
