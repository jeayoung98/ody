package com.ssafy.backend.music.videoid;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * videoid_api.py(EC2:8001) {@code GET /videoid} 응답 (S15P21A405-312).
 * {@code candidates} 등 나머지 필드는 이번 범위(best.videoId 만 사용)에서 읽지 않는다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record VideoIdApiResponse(VideoIdCandidate best) {

	@JsonIgnoreProperties(ignoreUnknown = true)
	public record VideoIdCandidate(String videoId) {
	}
}
