package com.ssafy.backend.music.journey;

/**
 * 경로 산출 위임 port (정본 §3.3). BE2가 계약 소유, <b>BE4 데이터 엔진이 산출 실행</b>(D4, 헌법 X).
 * 산출 방식(축 통로 + Viterbi, D10)과 파라미터는 이 인터페이스 뒤에 있고
 * <b>게이트웨이가 Java로 재구현하지 않는다</b>(FR-017). 전체 계약은 {@code contracts/music-journey.md §②}.
 *
 * <p>호출자가 알아야 할 것만 적는다:
 * <ul>
 *   <li>모드·정거장 수·detour 를 넘기지 않는다. 구현이 {@code axis} 로 고정하고 정거장 수는
 *       엔진이 {@code endpoint_dist} 로 정한다(D3, FR-011, FR-023).</li>
 *   <li><b>경로 없음은 예외가 아니라</b> {@code EnginePath.reachable() == false} 다.
 *       422(PATH_NOT_FOUND)와 500(엔진 부재)을 구분해야 하기 때문이다(2026-09-10 clarify).</li>
 *   <li>엔진 부재·타임아웃·프로토콜 오류는 예외로 던진다 → 500.</li>
 *   <li>부수효과 없음. 조회 전용(FR-018).</li>
 * </ul>
 *
 * <p>ponytail: 인터페이스만 정의. 어댑터({@code JourneyEngineClient}, RestClient)는 BE4가
 * {@code retrieval/api.py} 엔드포인트를 구현하고 {@code stations} 에 {@code mbid} 를 포함한 뒤(B-Engine).
 * 현재 {@code journey.py} 는 번들 행 인덱스({@code row})를 돌려주는데 게이트웨이는 그 값을 쓸 수 없다.
 */
public interface JourneyPathFinder {

	/**
	 * 두 곡 사이 경로를 산출한다.
	 *
	 * @param startMbid 출발곡 mbid
	 * @param endMbid   도착곡 mbid
	 * @return 중간 정거장 mbid 목록과 메타. 경로를 못 만들면 {@code reachable == false}
	 */
	EnginePath find(String startMbid, String endMbid);
}
