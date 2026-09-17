package com.ssafy.backend.realtime.dto.viewport;

/**
 * 화면에 표시할 사용자 한 명.
 *
 * @param email 프로필과 사용자 표시를 연결할 값
 * @param nickname 닉네임
 * @param imageUrl 프로필 사진 주소
 * @param riderCount 현재 따라오는 사용자 수
 */
public record ViewportUser(
		String email,
		String nickname,
		String imageUrl,
		int riderCount) {
}
