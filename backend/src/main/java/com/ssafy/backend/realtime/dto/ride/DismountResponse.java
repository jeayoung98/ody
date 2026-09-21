package com.ssafy.backend.realtime.dto.ride;

/**
 * 하차 응답. 내려서 어디에 남았는지 알려 준다.
 *
 * 인솔자가 마지막으로 있던 곡이다. 탑승 전 자리로 되돌리지 않는다.
 * 듣던 곡은 그대로 이어서 튼다 — 서버는 어떤 재생 명령도 보내지 않는다.
 * musicId·layer·x·y·cellX·cellY 는 {@code PlayResponse} 와 같은 뜻이다.
 */
public record DismountResponse(
		long musicId,
		int layer,
		double x,
		double y,
		int cellX,
		int cellY) {
}
