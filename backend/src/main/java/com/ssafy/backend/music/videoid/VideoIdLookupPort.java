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
	 * @param durationSeconds 원곡 길이(초). 알면 videoid_api.py 매칭 정확도가 크게 오른다(duration
	 *                        가중치 0.25). 모르면 {@code null} — duration 없이 조회한다.
	 * @return 가장 유력한 후보의 videoId. 후보가 없거나 외부 API 호출이 실패하면 빈 값
	 */
	Optional<String> lookup(String artist, String title, Integer durationSeconds);
}
