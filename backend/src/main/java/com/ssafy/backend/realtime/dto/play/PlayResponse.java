package com.ssafy.backend.realtime.dto.play;

/**
 * POST /music/play 응답. layer 는 요청자의 현재 레이어(presence 기준, 이 API로 안 바뀜).
 * x·y 는 현재 레이어 표시 2축 정규화 좌표(0~1, FE 내 마커 보정용), cellX·cellY 는 소속 셀(디버깅용).
 */
public record PlayResponse(
		long playHistoryId,
		long musicId,
		int layer,
		double x,
		double y,
		int cellX,
		int cellY) {
}
