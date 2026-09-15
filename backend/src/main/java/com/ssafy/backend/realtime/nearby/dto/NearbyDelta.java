package com.ssafy.backend.realtime.nearby.dto;

/**
 * 주변사람 목록의 한 사람 변경분.
 * ENTER·MOVE는 현재 곡을, LEAVE는 null을 보낸다. 좌표는 보내지 않는다.
 */
public record NearbyDelta(
		String email,
		String nickname,
		String imageUrl,
		Integer meetingCount,
		Integer riderCount,
		Long musicId) {
}
