package com.ssafy.backend.realtime.dto.ride;

/**
 * S→C RIDE_TRACK — 인솔자가 곡을 바꿨다 (RT-33).
 *
 * <p>새 곡은 처음부터 튼다. 그래서 재생 위치를 싣지 않는다.
 * 곡 제목·아티스트도 싣지 않는다 — 각 동승자가 기존 상세 엔드포인트로 가져간다.
 *
 * @param x 원시 PC 좌표. 뷰포트·셀 인원수와 같은 지도 좌표계다
 * @param playable 재생 가능 여부. false 면 위치만 옮기고 틀지 않는다
 * @param serverTs 기준 시각
 */
public record RideTrackPayload(
		long musicId,
		int layer,
		double x,
		double y,
		boolean playable,
		long serverTs) {
}
