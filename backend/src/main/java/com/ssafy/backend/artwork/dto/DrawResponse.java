package com.ssafy.backend.artwork.dto;

import java.util.List;

/**
 * {@code POST /api/artwork/draw} 응답 (S15P21A405-598).
 *
 * @param score   모양 일치도 0~100. 이동·회전·균일 배율 불변, 좌우 반전은 다른 모양
 * @param quality {@code HIGH}(≥90) · {@code MEDIUM}(≥70) · {@code LOW}. LOW 도 정상 응답이다 — 화면이 경고를 띄운다
 * @param points  요청 점 순서 그대로, 곡 중복 없음. 좌표는 배치 API 가 같은 곡 목록에 돌려주는 값과 같다
 */
public record DrawResponse(int score, String quality, List<DrawTrack> points) {
}
