package com.ssafy.backend.user.dto;

/**
 * 프로필 부분 수정 요청. 필드가 null이면 미전달로 간주해 기존 값을 유지한다(PATCH 시맨틱).
 */
public record UserProfileUpdateRequest(String nickname, String imageUrl) {
}
