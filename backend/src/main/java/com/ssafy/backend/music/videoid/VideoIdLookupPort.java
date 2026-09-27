package com.ssafy.backend.music.videoid;

import java.util.Optional;

/**
 * videoId 실시간 조회 port (S15P21A405-312, 프로토타입).
 *
 * <p>spec 006(S15P21A405-57) FR-006 의 공식 확보 조건(길이 매칭·embeddable)은 적용하지 않는다 —
 * 개인이 EC2 에 배포한 videoid_api.py(yt-dlp+rapidfuzz 퍼지매칭)를 그대로 쓰는 임시 경로다.
 */
public interface VideoIdLookupPort {

	/**
	 * @param album           앨범명. 있으면 resolver 가 "artist title album" 검색을 한 번 더 돌리고,
	 *                        설명란에 앨범명이 박힌 공식 Art Track 을 알아본다({@code data/videoid/resolver.py}).
	 *                        모르면 {@code null} — 앨범 없이 조회한다. resolver 는 정규화 길이 4자 미만인
	 *                        앨범명을 무시하므로 짧은 이름은 보내도 공식 판정에 쓰이지 않는다
	 * @param durationSeconds 원곡 길이(초). 알면 videoid_api.py 매칭 정확도가 크게 오른다(duration
	 *                        가중치 0.25). 모르면 {@code null} — duration 없이 조회한다.
	 * @return 가장 유력한 후보의 videoId. 후보가 없거나 외부 API 호출이 실패하면 빈 값
	 */
	Optional<String> lookup(String artist, String title, String album, Integer durationSeconds);
}
