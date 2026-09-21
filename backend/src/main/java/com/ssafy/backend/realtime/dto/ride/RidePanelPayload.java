package com.ssafy.backend.realtime.dto.ride;

/**
 * S→C RIDE_PANEL — 인솔자가 연 곡 상세를 따라가는 사람들에게 알린다.
 *
 * 곡 번호와 탭만 보내고 상세 내용은 보내지 않는다. 받는 쪽이 평소처럼 자기가 조회한다.
 * 그래야 한 명이 조회에 실패해도 그 사람만 빈 화면이고 나머지는 멀쩡하다.
 *
 * @param open 열렸으면 true. false 면 아래 둘은 null 이다
 * @param musicId 열려 있는 곡
 * @param tab 보고 있는 탭
 */
public record RidePanelPayload(boolean open, Long musicId, RidePanelTab tab) {

	/** 닫힌 상태를 만든다. */
	public static RidePanelPayload closed() {
		return new RidePanelPayload(false, null, null);
	}

	/** 열린 상태를 만든다. */
	public static RidePanelPayload opened(long musicId, RidePanelTab tab) {
		return new RidePanelPayload(true, musicId, tab);
	}
}
