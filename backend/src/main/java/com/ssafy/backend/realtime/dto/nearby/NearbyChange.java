package com.ssafy.backend.realtime.dto.nearby;

/**
 * 주변사람 목록의 한 사람 변경분.
 *
 * ENTER·MOVE 는 현재 곡과 그 자리를, LEAVE 는 전부 null 을 보낸다.
 *
 * 자리를 같이 보낸다 (S15P21A405-582). 기준이 레이어 전체가 되면서 받는 쪽이 패널을
 * 미니맵으로 그리는데, 좌표가 안 오면 곡이 바뀐 사람만 자리를 모른 채 남는다.
 *
 * 거리는 담지 않는다. 받는 사람마다 다른 값이라 서버가 구하려면 사람 수만큼 조회가 돈다.
 * 받는 쪽은 자기 자리를 알고 있으므로 좌표만 있으면 스스로 잰다.
 */
public record NearbyChange(
		String email,
		String nickname,
		String imageUrl,
		Integer meetingCount,
		Integer riderCount,
		Long musicId,
		Double x,
		Double y) {
}
