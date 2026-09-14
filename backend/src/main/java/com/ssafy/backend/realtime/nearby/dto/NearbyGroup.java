package com.ssafy.backend.realtime.nearby.dto;

import java.util.List;

import com.ssafy.backend.realtime.presence.dto.UserView;

/**
 * 곡 하나 + 그 곡을 지금 듣고 있는 사람들.
 * 내가 듣는 곡도 거리 0으로 같이 들어간다(제일 가까운 사람들이니까).
 * x, y = 이 곡을 지금 내 지도 화면 어디에 찍을지(0~1로 맞춘 값). distance = 내 곡이랑 이 곡이 얼마나 떨어졌나.
 * users = 그 곡 듣는 사람들(닉네임·프로필 사진만, 이메일은 절대 안 담음). 나 자신은 뺀다.
 * 듣는 사람이 아무도 없는 곡은 아예 이 그룹을 안 만든다.
 * (사람 표현은 이미 있는 UserView 를 그대로 쓴다)
 */
public record NearbyGroup(
		long musicId,
		String title,
		String artist,
		double x,
		double y,
		double distance,
		List<UserView> users) {
}
