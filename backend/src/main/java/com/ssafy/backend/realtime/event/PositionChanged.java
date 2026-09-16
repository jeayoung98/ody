package com.ssafy.backend.realtime.event;

/**
 * 화면 사용자와 주변사람 갱신에 함께 쓰는 위치 변경 정보.
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
