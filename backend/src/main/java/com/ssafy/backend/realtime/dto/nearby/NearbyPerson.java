package com.ssafy.backend.realtime.dto.nearby;

/**
 * 주변사람 목록의 한 사람. 곡별로 묶지 않고 사람 한 명씩 쭉 나열한다(평면 목록).
 * 이 사람이 지금 무슨 곡을 듣는지(musicId·title·artist)와, 그 곡이 내 곡과 얼마나 떨어졌는지(distance)를 같이 담는다.
 * distance 는 가까운 순으로 정렬하는 데 쓴다. 지도에 점으로 찍는 좌표는 여기 없다 — 그건 뷰포트 몫.
 * email은 프로필 버튼의 대상 식별자다. nickname 은 비어 있을(null) 수 있다.
 */
public record NearbyPerson(
		String email,
		String nickname,
		String imageUrl,
		int meetingCount,
		int riderCount,
		long musicId,
		String title,
		String artist,
		double distance) {
}
