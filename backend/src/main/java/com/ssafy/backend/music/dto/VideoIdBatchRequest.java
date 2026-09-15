package com.ssafy.backend.music.dto;

import java.util.List;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * musicId → videoId 일괄 조회 요청 (S15P21A405-322, 프로토타입).
 *
 * @param musicIds 조회할 곡. 1개 이상 {@value #MAX_IDS} 개 이하 — videoId 가 없는 곡마다
 *                 외부 videoid API 를 순차 호출하므로(최악 5초/건) 한 번에 너무 많이 받으면
 *                 응답이 오래 걸린다
 */
public record VideoIdBatchRequest(
		@NotNull @Size(min = 1, max = VideoIdBatchRequest.MAX_IDS) List<@NotNull @Min(1) Long> musicIds) {

	public static final int MAX_IDS = 20;
}
