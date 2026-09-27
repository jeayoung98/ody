package com.ssafy.backend.realtime.dto.viewport;

import java.util.List;

/**
 * 현재 화면의 사용자 또는 셀별 사용자 수.
 *
 * @param requestSeq 화면 요청 순번
 * @param mode 사용자 표시 방식
 * @param layer 현재 레이어
 * @param groups 곡 위치별 사용자 목록
 * @param resolution 한 줄의 셀 수. 개별 사용자 방식이면 null
 * @param cells 셀별 사용자 수
 */
public record ViewportSnapshot(
		long requestSeq,
		ViewportMode mode,
		int layer,
		List<ViewportMusicGroup> groups,
		Integer resolution,
		List<ViewportCellCount> cells) {

	/** 응답 목록이 밖에서 바뀌지 않도록 복사한다. */
	public ViewportSnapshot {
		groups = List.copyOf(groups);
		cells = List.copyOf(cells);
	}

	/**
	 * 개별 사용자 목록 응답을 만든다.
	 * @param requestSeq 화면 요청 순번
	 * @param layer 현재 레이어
	 * @param groups 곡 위치별 사용자 목록
	 * @return 개별 사용자 목록 응답
	 */
	public static ViewportSnapshot individual(long requestSeq, int layer, List<ViewportMusicGroup> groups) {
		return new ViewportSnapshot(
				requestSeq, ViewportMode.INDIVIDUAL, layer, groups, null, List.of());
	}

	/**
	 * 셀별 사용자 수 응답을 만든다.
	 * @param requestSeq 화면 요청 순번
	 * @param layer 현재 레이어
	 * @param resolution 한 줄에 표시할 셀 수
	 * @param cells 셀별 위치와 사용자 수
	 * @return 셀별 사용자 수 응답
	 */
	public static ViewportSnapshot clustered(
			long requestSeq, int layer, int resolution, List<ViewportCellCount> cells) {
		return new ViewportSnapshot(
				requestSeq, ViewportMode.CLUSTERED, layer, List.of(), resolution, cells);
	}
}
