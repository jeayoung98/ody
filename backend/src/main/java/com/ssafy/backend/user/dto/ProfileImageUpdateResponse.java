package com.ssafy.backend.user.dto;

/**
 * 프로필 이미지 수정 응답 (S15P21A405-426). imageUrl 은 절대 URL 이라 구글 프로필 사진과 같은 형태다.
 */
public record ProfileImageUpdateResponse(String imageUrl) {
}
