package com.ssafy.backend.artwork.dto;

/** 템플릿 목록 한 줄. {@code pointCount} 가 곧 생성될 플레이리스트의 곡 수다. */
public record CatTemplateSummary(String name, String label, int pointCount) {
}
