package com.ssafy.backend.music.dto;

import java.util.List;

/**
 * 대표곡 조회 응답 (정본 §3.4): data.content 배열.
 */
public record MajorResponse(List<MusicDetail> content) {
}
