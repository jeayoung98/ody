package com.ssafy.backend.music.dto;

import java.util.List;

/**
 * 대표곡(레이어 상주 집합) 조회 응답 (D18): data.content 배열.
 * 원소는 MapPoint 다 — 정본 §0.6 MusicDetail 이 아니다. 상세 필드는 /music/detail 담당이다.
 */
public record MajorResponse(List<MapPoint> content) {
}
