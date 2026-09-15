package com.ssafy.backend.music.journey;

import java.util.List;

/**
 * 경로 산출 결과 (핸드오프 §4.7). <b>산출 경계 안쪽 표현이며 클라이언트에 그대로 나가지 않는다</b>(FR-023).
 *
 * <p>rev.3 에서 산출 주체가 원격 파이썬 엔진에서 백엔드 인프로세스로 바뀌었다. 필드 구성은 그대로다 —
 * 응답 계약(정본 §3.3)이 바뀌지 않았고, 호출부가 이 값을 조립하는 방식도 그대로이기 때문이다.
 *
 * @param reachable    {@code false} 면 422 PATH_NOT_FOUND. 조회 어댑터 부재·재산출 상한 소진은
 *                     이 값이 아니라 예외로 온다(500 과 구분)
 * @param stationIds   <b>중간 정거장 id(PK) 만.</b> 출발·도착은 들어 있지 않다(핸드오프 §4.7 —
 *                     "{@code stations} 는 A·B 를 포함하지 않는다"). 순서가 곧 경로 순서다 —
 *                     상세 조회 결과 순서에 의존하면 안 된다(FR-005). {@code reachable} 이 false 면 빈 목록.
 *                     <b>rev.4</b>: 원격 엔진 잔재인 mbid 대신 id 로 낸다 — 조립이 무인덱스 mbid 풀스캔을
 *                     피하고 PK 로 읽는다(S15P21A405-313). 응답(MusicDetail)은 그대로라 계약 불변
 * @param progresses   각 정거장의 진행도 {@code p}(A=0, B=1)
 * @param endpointDist 끝점 거리 {@code L = ‖B − A‖}
 * @param far          {@code endpointDist > farEndpointDist}(기본 10.7, D3). 역 수를 늘리는 기준
 * @param mode         {@code "axis"}(기본, D10) 또는 {@code "linear"}(폴백·비교용)
 * @param bundle       임계값이 귀속된 좌표 아티팩트 버전. <b>rev.3</b>: 원격 엔진이 응답에 담아 주던 값이라
 *                     인프로세스에서는 {@code ServingRules.bundle}(설정)에서 읽는다
 */
public record EnginePath(
		boolean reachable,
		List<Long> stationIds,
		List<Double> progresses,
		double endpointDist,
		boolean far,
		String mode,
		String bundle) {

	/**
	 * 정거장 진행도가 순서대로 증가하는가. 정거장이 1개 이하면 항상 참이다.
	 *
	 * <p><b>rev.3 — 뜻이 바뀌었다.</b> 이전에는 남이 준 값을 검증하는 항목이었으나 이제는
	 * <b>자기 산출물의 자기 검증</b>이다. {@code axis} 에서 위반이 나오면 데이터 문제가 아니라
	 * <b>산출 구현의 결함</b>이다 — DP 의 {@code p(v) > p(u)} 제약이 빠졌거나 층 후보가 겹친 것이다(FR-020).
	 *
	 * <p>반대로 {@code linear} 폴백의 역행은 그 방식의 알려진 성질이라 결함이 아니다
	 * (같은 40쌍에서 21건, 핸드오프 §4.1).
	 */
	public boolean progressMonotonic() {
		for (int i = 1; i < progresses.size(); i++) {
			if (progresses.get(i) <= progresses.get(i - 1)) {
				return false;
			}
		}
		return true;
	}
}
