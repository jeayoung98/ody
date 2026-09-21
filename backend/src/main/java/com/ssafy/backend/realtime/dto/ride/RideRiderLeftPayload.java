package com.ssafy.backend.realtime.dto.ride;

/**
 * S→C RIDE_RIDER_LEFT — 따라오던 사람이 내렸다고 인솔자에게 알린다.
 *
 * 스스로 내린 것과 접속이 끊겨 빠진 것을 구분하지 않는다. 인솔자가 할 일이 같기 때문이다.
 *
 * @param email 내린 사람
 * @param riderCount 내린 뒤 남은 인원. 인솔자가 다시 물어보지 않아도 되게 같이 준다
 */
public record RideRiderLeftPayload(String email, int riderCount) {
}
