package com.ssafy.backend.music.retrieval;

import java.util.List;

/**
 * 임의 16차원 좌표의 최근접 곡 조회 port (T049).
 *
 * <p><b>여정(004)과 주변 탐색(005)이 같은 port 를 쓴다</b>(D-005). 핸드오프 §3.2(주변 탐색)와
 * §4.3(여정 층 후보)의 SQL 이 {@code ORDER BY location <-> :q LIMIT n} 으로 동일하기 때문이다.
 * 따로 만들면 같은 곡에 다른 규칙이 적용된다.
 *
 * <h2>구현이 지킬 것 — 어기면 조용히 틀린다</h2>
 * <ul>
 *   <li><b>기준점을 조회 안에서 계산하지 않는다.</b> 좌표를 먼저 읽어 <b>바인드 파라미터</b>로 넘긴다.
 *       서브쿼리로 넘기면 실행계획에서 {@code InitPlan} 이 되어 HNSW 가 그 값을 쓰지 못한다 —
 *       2026-09-10 실측 <b>recall 0.0000</b>, 거리 0 인 자기 자신 대신 거리 23.3 짜리가 1위로 나왔다.
 *       오류가 아니라 답이 조용히 틀리는 경로다. 바인드로 넘기면 recall 0.9995 (핸드오프 §3.2 함정 1).</li>
 *   <li><b>후처리 필터를 조회에 넣지 않는다.</b> pgvector 0.7.0 에는 iterative index scan 이 없어
 *       HNSW 가 {@code ef_search} 개를 먼저 뽑고 그 뒤에 {@code WHERE} 를 적용한다. 필터를 걸면
 *       요청한 {@code limit} 보다 적게 돌아온다. 그래서 넉넉히 뽑아 <b>애플리케이션에서 거른다</b>
 *       (핸드오프 §3.2 함정 2).</li>
 *   <li>거리는 <b>L2</b>({@code <->}, {@code vector_l2_ops})다. 코사인·내적으로 바꾸면
 *       {@code tau_dup}·{@code tau_far} 같은 임계값이 전부 무의미해진다(핸드오프 §2).</li>
 *   <li>부수효과 없음. 조회 전용.</li>
 * </ul>
 *
 * <p>구현체가 없으면 호출부가 {@code Optional} 로 받아 미구현을 드러낸다 — 목 좌표나 임시 조회를
 * 운영 코드에 남기지 않는다(FR-019).
 */
public interface NearestTrackReader {

	/**
	 * 지점 좌표에서 가장 가까운 곡을 거리 오름차순으로 돌려준다.
	 *
	 * @param point 16차원 질의 좌표. 호출자가 값으로 넘긴다(위 "기준점을 조회 안에서 계산하지 않는다")
	 * @param limit 뽑을 후보 수. 후처리가 걸러내므로 <b>필요한 수가 아니라 넉넉한 수</b>를 넣는다 —
	 *              핸드오프 기준 주변 탐색 100, 여정 층 후보 200
	 * @return 최대 {@code limit} 개. <b>근사 조회라 동률·경계에서 순서가 흔들릴 수 있다</b> —
	 *         결과에 의존하는 쪽이 (거리, id) 로 안정 정렬한다(FR-013)
	 */
	List<TrackCandidate> findNearest(float[] point, int limit);
}
