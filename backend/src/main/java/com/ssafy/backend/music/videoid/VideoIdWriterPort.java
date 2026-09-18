package com.ssafy.backend.music.videoid;

/** videoId 판정 저장 port (S15P21A405-312, S15P21A405-454). */
public interface VideoIdWriterPort {

	void save(long musicId, String videoId);

	/**
	 * 재생 불가로 확정한다. 판정의 정본은 {@code music.is_unplayable} 이다 — 삭제 배치가 그 값을
	 * 보고, 검색·대표곡 목록도 그 값으로 곡을 제외한다(S15P21A405-454).
	 */
	void markUnplayable(long musicId);
}
