package com.ssafy.backend.music.journey;

import java.util.List;

/**
 * BE4 데이터 엔진의 경로 응답 (data 스펙 11, {@code retrieval/journey.py}).
 * <b>게이트웨이 내부 표현이며 클라이언트에 그대로 나가지 않는다</b>(FR-023).
 *
 * @param reachable    false 면 422 PATH_NOT_FOUND. 엔진 부재·타임아웃은 이 값이 아니라 예외로 온다.
 * @param stationMbids <b>중간 정거장만.</b> 출발·도착은 들어 있지 않다({@code journey.py} 의 {@code path[1:-1]}).
 *                     순서가 곧 경로 순서다 — 상세 조회 결과 순서에 의존하면 안 된다(FR-005).
 * @param progresses   각 정거장의 진행도(A=0, B=1). 단조 증가 검사용. 위반해도 응답을 막지 않고 기록만 한다(FR-020).
 * @param endpointDist 두 곡 사이 거리. 로그 전용.
 * @param far          {@code endpointDist > 10.7} (D3). 로그 전용.
 * @param mode         항상 "axis"(D10). 로그 전용.
 * @param bundle       좌표 아티팩트 버전(예 v2.1-pca16). 로그 전용 — 대조하지 않는다(research R11).
 */
public record EnginePath(
		boolean reachable,
		List<String> stationMbids,
		List<Double> progresses,
		double endpointDist,
		boolean far,
		String mode,
		String bundle) {

	/** 엔진이 준 진행도가 순서대로 증가하는지. 정거장이 1개 이하면 항상 참이다. */
	public boolean progressMonotonic() {
		for (int i = 1; i < progresses.size(); i++) {
			if (progresses.get(i) <= progresses.get(i - 1)) {
				return false;
			}
		}
		return true;
	}
}
