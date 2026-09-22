package com.ssafy.backend.music.mapper;

import org.apache.ibatis.annotations.Param;

/**
 * videoId 저장 전용 MyBatis 매퍼 (S15P21A405-312, 프로토타입).
 * 검색·상세·주변탐색·경로탐색 네 어댑터가 {@link com.ssafy.backend.music.videoid.VideoIdEnricher}
 * 를 통해 공유한다.
 */
public interface VideoIdMapper {

	int updateVideoId(@Param("musicId") long musicId, @Param("videoId") String videoId);

	/**
	 * 재생 불가 확정. {@code video_id} 는 쓰지 않는다 — 판정의 정본은 플래그다(S15P21A405-454).
	 *
	 * @return 1 이면 세웠고, <b>0 이면 이미 videoId 가 있어 세우지 않았다</b>(S15P21A405-568 경합)
	 */
	int markUnplayable(@Param("musicId") long musicId);
}
