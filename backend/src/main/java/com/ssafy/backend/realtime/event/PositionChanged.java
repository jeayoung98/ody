package com.ssafy.backend.realtime.event;

/**
 * 화면 사용자와 주변사람 갱신에 함께 쓰는 위치 변경 정보.
 * 진입은 이전 값이 없고, 이탈은 새 값이 없다. 셀은 "{cellX}:{cellY}" 형식이다.
 * x와 y는 새 위치를 화면에 표시할 때 쓰는 좌표다.
 */
public record PositionChanged(
		String email,
		long epoch,
		Integer oldLayer, // 좌표는 같은데 레이어가 다를때 이전 레이어 지금 레이어 구별
		Integer newLayer, // 좌표는 같은데 레이어가 다를때 이전 레이어 지금 레이어 구별
		Long oldMusicId,
		Long newMusicId,
		String oldCell,
		String newCell,
		Double x,
		Double y) {
}
