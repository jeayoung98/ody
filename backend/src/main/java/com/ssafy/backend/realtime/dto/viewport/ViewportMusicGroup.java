package com.ssafy.backend.realtime.dto.viewport;

import java.util.List;

/**
 * 같은 곡 위치에 있는 사용자들.
 *
 * @param musicId 재생 중인 곡 ID
 * @param x 0부터 1 사이의 가로 위치
 * @param y 0부터 1 사이의 세로 위치
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
