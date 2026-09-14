package com.ssafy.backend.user.dto;

/**
 * 공개 설정(is_public) 변경 요청.
 */
public record PublicVisibilityUpdateRequest(Boolean isPublic) {
}
