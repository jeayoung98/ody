package com.ssafy.backend.realtime.dto.ride;

/**
 * C→S /app/ride/panel — 인솔자가 곡 상세를 열거나 닫거나 탭을 바꿨을 때 보낸다.
 *
 * 소켓 요청은 @Valid 가 걸리지 않아 JoinRequest 처럼 직접 검사한다.
 *
 * @param open 열었으면 true, 닫았으면 false
 * @param musicId 열고 있는 곡. 닫을 때는 없어도 된다
 * @param tab 보고 있는 탭. 닫을 때는 없어도 된다
 */
public record RidePanelRequest(Boolean open, Long musicId, RidePanelTab tab) {

	/** 요청값을 검사한다. */
	public void validate() {
		if (open == null) {
			throw new IllegalArgumentException("열었는지 닫았는지가 비어 있다");
		}
		// 닫을 때는 곡도 탭도 볼 필요가 없다. 그냥 닫으면 끝이다.
		if (!open) {
			return;
		}
		if (musicId == null || musicId <= 0) {
			throw new IllegalArgumentException("열려면 곡 번호가 있어야 한다");
		}
		if (tab == null) {
			throw new IllegalArgumentException("탭이 비어 있거나 모르는 값이다");
		}
	}
}
