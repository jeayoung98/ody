package com.ssafy.backend.music.journey;

/**
 * 경로 산출 위임 port (정본 §3.3). BE2가 계약 소유, <b>BE4 데이터 엔진이 산출 실행</b>(D4, 헌법 X).
 *
 * <p>경로 산출 알고리즘은 이 인터페이스 뒤에 있다. 축 통로(진행도 p·축 이탈 r) + Viterbi 로
 * 비용 {@code Σ 걸음² + λ·Σ 축이탈²} 을 최소화하는 방식이며(D10, {@code axis} 모드),
 * <b>게이트웨이가 Java로 재구현하지 않는다</b>(FR-017).
 *
 * <h2>계약</h2>
 * <ul>
 *   <li>모드는 구현이 {@code axis} 로 고정 호출한다. 파라미터로 받지 않는다 — 정본 §3.3 에
 *       {@code mode} 가 없고 D2→D10 이 UI 토글을 두지 않기로 했다(FR-023).</li>
 *   <li>정거장 수도 넘기지 않는다. 엔진이 {@code endpoint_dist} 로 정한다 —
 *       10.7 이하면 10, 초과하면 {@code clamp(round(10 + (dist − 10.7)), 10, 20)} (D3, FR-011).</li>
 *   <li>통로 반경·λ·층 후보 상한·완화 단계는 엔진 내부 파라미터다. BE2가 정하거나 노출하지 않는다.</li>
 *   <li><b>경로 없음은 예외가 아니라</b> {@code EnginePath.reachable() == false} 로 표현한다.
 *       422(PATH_NOT_FOUND)와 500(엔진 부재)을 구분해야 하기 때문이다(2026-09-10 clarify).</li>
 *   <li>엔진 부재·타임아웃·프로토콜 오류는 예외로 던진다 → 500 INTERNAL_SERVER_ERROR.</li>
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
