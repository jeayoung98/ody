package com.ssafy.backend.realtime.common;

/**
 * 위치 변경 이벤트 — 화면 사용자(RT-22)·근처 사람(RT-11) 델타의 공통 입력(plan §F5).
 * 진입: oldMusicId=null. 이탈: newMusicId=null. 이동: 둘 다 present. 셀은 "{cellX}:{cellY}".
 */
public record PositionChanged(
		String email,
		long epoch,
		int layer,
		Long oldMusicId,
		Long newMusicId,
		String oldCell,
		String newCell,
		Double x,
		Double y) {
}
