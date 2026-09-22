package com.ssafy.backend.realtime.dto.ride;

/**
 * S→C RIDE_RIDER_JOINED — 누가 따라오기 시작했다고 인솔자에게 알린다.
 *
 * 인솔자는 자기를 몇 명이 따라오는지 알 길이 이것뿐이다. 남들 화면에 나가는 인원수 알림은
 * 인솔자 자리를 보는 사람들에게 가는 것이라 인솔자 본인은 빠진다.
 *
 * 이름을 같이 보내는 이유는 탈 때가 처음 보는 사람이기 때문이다. 내릴 때는 이미 목록에
 * 있던 사람이라 번호만 보내도 되지만, 여기서는 받는 쪽이 이름을 찾을 근거가 없다.
 *
 * @param email 탄 사람
 * @param nickname 탄 사람의 이름. 없을 수 있다
 * @param riderCount 탄 뒤의 인원. 인솔자가 다시 물어보지 않아도 되게 같이 준다
 */
public record RideRiderJoinedPayload(String email, String nickname, int riderCount) {
}
