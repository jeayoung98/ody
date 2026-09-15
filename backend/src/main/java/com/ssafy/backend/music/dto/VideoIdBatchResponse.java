package com.ssafy.backend.music.dto;

import java.util.List;

/** musicId → videoId 일괄 조회 응답 (S15P21A405-322). 요청한 musicId 중 없는 곡은 결과에서 빠진다. */
public record VideoIdBatchResponse(List<VideoIdItem> items) {
}
