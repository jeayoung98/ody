package com.ssafy.backend.artwork.dto;

import jakarta.validation.constraints.NotBlank;

/** 고양이 플레이리스트 생성 요청. {@code template} 은 {@code GET /api/artwork/templates} 의 {@code name}. */
public record CatPlaylistRequest(@NotBlank String template) {
}
