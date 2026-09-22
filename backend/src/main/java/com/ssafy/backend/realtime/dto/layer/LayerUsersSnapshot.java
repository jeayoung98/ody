package com.ssafy.backend.realtime.dto.layer;

import java.util.List;

import com.ssafy.backend.realtime.dto.viewport.ViewportMusicGroup;

/**
 * 한 레이어에서 지금 재생 중인 사용자 전부 (GET /api/realtime/layers/{layer}/users 응답).
 * 화면 범위·줌 레벨과 무관하게 그 레이어의 모든 사용자를 곡 위치별로 묶어 준다.
 * 묶음 모양은 소켓 VIEWPORT_SNAPSHOT(INDIVIDUAL) 의 groups 와 같다 — 프론트가 변환기를 하나만 둔다.
 *
 * @param layer 조회한 레이어 (0-based, 프론트와 같다)
 * @param groups 곡 위치별 사용자 목록. x·y 는 그 레이어 표시축의 원시 PC 좌표
 */
public record LayerUsersSnapshot(int layer, List<ViewportMusicGroup> groups) {
	/** 응답 목록이 밖에서 바뀌지 않도록 복사한다. */
	public LayerUsersSnapshot {
		groups = List.copyOf(groups);
	}
}
