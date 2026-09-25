package com.ssafy.backend.realtime.dto.ride;

/**
 * 실시간 탑 버스기사 한 줄.
 *
 * 값 이름을 riderCount 로 둔다. 지금 태우고 있는 인원이지 여태 태운 누적이 아니다 —
 * score 라고 하면 누적으로 읽힌다. 프론트 공용 타입에 맞추는 일은 BFF 가 한다.
 *
 * @param rank 1부터. 인원이 같아도 번호는 겹치지 않는다
 * @param email 그 사람. 받는 쪽이 이 값으로 피드를 연다
 * @param nickname 아직 안 정했거나 탈퇴했으면 null
 * @param imageUrl 없으면 null
 * @param riderCount 지금 따라오는 사람 수
 */
public record RideRankingItem(
		int rank, String email, String nickname, String imageUrl, int riderCount) {
}
