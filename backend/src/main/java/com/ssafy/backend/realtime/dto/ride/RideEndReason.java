package com.ssafy.backend.realtime.dto.ride;

/** 따라가기가 끝난 이유. */
public enum RideEndReason {
	/**
	 * 인솔자가 사라졌다.
	 *
	 * 스스로 나간 것과 접속이 끊긴 것을 구분하지 않는다. 따라가던 사람이 할 일이 같기 때문이다.
	 */
	CAPTAIN_LEFT
}
