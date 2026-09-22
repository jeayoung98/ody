package com.ssafy.backend.realtime.dto.ride;

/**
 * 해체 응답. 몇 명을 내렸고 그 사람들이 어디에 남았는지 알려 준다.
 *
 * 인솔자 자신은 움직이지 않는다 — 서 있던 곡에 그대로 있고 듣던 곡도 끊기지 않는다.
 * 그래서 이 값들은 전부 내려간 사람들 이야기다. 인솔자 화면은 인원수를 0 으로 되돌리면 된다.
 *
 * musicId·layer 는 인솔자가 서 있는 곡과 같다. 내린 사람들이 바로 그 자리에 남기 때문이다.
 *
 * @param riderCount 내린 사람 수
 * @param musicId 내린 사람들이 남은 곡
 * @param layer 내린 사람들이 남은 레이어
 */
public record DisbandResponse(
		int riderCount,
		long musicId,
		int layer) {
}
