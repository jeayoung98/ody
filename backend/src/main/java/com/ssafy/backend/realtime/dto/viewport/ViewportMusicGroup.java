package com.ssafy.backend.realtime.dto.viewport;

import java.util.List;

/**
 * 같은 곡 위치에 있는 사용자들.
 *
 * @param musicId 재생 중인 곡 ID
 * @param x 현재 레이어 가로축의 원시 PC 좌표 (화면 요청 minX~maxX 와 같은 좌표계)
 * @param y 현재 레이어 세로축의 원시 PC 좌표 (minY~maxY 와 같은 좌표계)
 * @param users 이 곡을 듣는 사용자들
 */
public record ViewportMusicGroup(
		long musicId,
		double x,
		double y,
		List<ViewportUser> users) {

	/** 사용자 목록이 밖에서 바뀌지 않도록 복사한다. */
	public ViewportMusicGroup {
		users = List.copyOf(users);
	}
}
