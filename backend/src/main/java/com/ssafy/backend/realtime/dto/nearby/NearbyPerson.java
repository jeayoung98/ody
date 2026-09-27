package com.ssafy.backend.realtime.dto.nearby;

/**
 * 주변사람 목록의 한 사람. 곡별로 묶지 않고 사람 한 명씩 쭉 나열한다(평면 목록).
 *
 * 기준이 내 레이어 전체다 (S15P21A405-582). 예전에는 내 곡과 비슷한 곡 열 개를 듣는 사람만
 * 담았는데, 사람이 적을 때 목록이 거의 비어서 그 층에 있는 사람을 전부 담는 것으로 바꿨다.
 * 패널을 그 층의 미니맵으로 본다.
 *
 * 곡 제목과 가수는 담지 않는다 — 화면이 사람만 보여 주기로 했다.
 *
 * x·y 는 그 레이어 표시축의 원시 좌표다. 지도에 찍는 값과 같은 눈금이라, 받는 쪽이
 * 같은 곡을 듣는 사람을 같은 자리에 모아 그릴 수 있다.
 *
 * distance 는 내 자리에서 그 사람까지의 거리다. 정렬과 레이더의 반지름에 쓴다.
 * 좌표를 주므로 받는 쪽이 계산할 수도 있지만, 인원 상한을 서버가 이 값으로 자르기 때문에
 * 같은 값을 두 번 구하지 않도록 함께 보낸다.
 *
 * email 은 프로필 버튼의 대상 식별자다. nickname 은 비어 있을(null) 수 있다.
 */
public record NearbyPerson(
		String email,
		String nickname,
		String imageUrl,
		int meetingCount,
		int riderCount,
		long musicId,
		double x,
		double y,
		double distance) {
}
