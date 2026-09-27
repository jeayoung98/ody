package com.ssafy.backend.realtime.dto.presence;

/**
 * 화면 노출 사용자 표현 — nickname + imageUrl 만(FR-030, email 금지). nickname 은 NULL·중복 가능.
 */
public record UserDisplay(String nickname, String imageUrl) {
}
