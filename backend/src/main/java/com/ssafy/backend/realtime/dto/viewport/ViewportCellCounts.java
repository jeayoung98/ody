package com.ssafy.backend.realtime.dto.viewport;

import java.util.List;

/**
 * 뭉친 셀의 최신 사용자 수.
 *
 * @param requestSeq 화면 요청 순번
 * @param layer 현재 레이어
 * @param resolution 한 줄에 표시할 셀 수
 * @param cells 셀별 위치와 사용자 수
 */
public record ViewportCellCounts(
		long requestSeq,
		int layer,
		int resolution,
		List<ViewportCellCount> cells) {

	/** 셀 목록이 밖에서 바뀌지 않도록 복사한다. */
	public ViewportCellCounts {
		cells = List.copyOf(cells);
	}
}
