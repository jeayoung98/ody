package com.ssafy.backend.user.dto;

/**
 * 닉네임 수정 요청 (S15P21A405-426). 프로필 이미지 수정은 multipart 전용 API 로 분리되어 있다.
 */
public record NicknameUpdateRequest(String nickname) {
}
