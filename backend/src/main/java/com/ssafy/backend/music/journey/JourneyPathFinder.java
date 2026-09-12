package com.ssafy.backend.music.journey;

import com.ssafy.backend.music.dto.MusicDetail;

/**
 * 경로 산출 경계 (정본 §3.3). <b>산출은 백엔드 프로세스 안에서 수행한다</b>(FR-017 rev.3, D12).
 *
 * <p>방식은 데이터 파트가 정의한 {@code axis}(축 통로 + Viterbi, D10) 그대로이고 <b>실행 위치만</b>
 * 백엔드로 옮겼다 — 알고리즘을 새로 설계하는 것이 아니다. 절차·파라미터·임계값의 출처는
 * {@code data/docs/BE_ALGORITHM_HANDOFF.md} §4 다.
 *
 * <p>인터페이스를 남겨 두는 이유는 두 가지다. 나중에 다시 원격 산출로 빼낼 수 있어야 하고,
 * 산출을 호출부(응답 조립·오류 매핑)와 섞으면 어느 쪽도 따로 검증할 수 없다(FR-019).
 *
 * <h2>계약</h2>
 * <ul>
 *   <li>모드·정거장 수·detour 를 인자로 받지 않는다. 구현이 {@code axis} 로 고정하고 역 수는
 *       끝점 거리 {@code L} 로 정한다 — {@code L ≤ 10.7} 이면 10, 초과하면
 *       {@code clamp(round(10 + (L − 10.7)), 10, 20)} (D3, FR-011, FR-023).
 *       <b>먼 곡을 거절하지 않고 역만 늘린다.</b></li>
 *   <li><b>경로 없음은 예외가 아니라</b> {@code EnginePath.reachable() == false} 다.
 *       422(PATH_NOT_FOUND)와 500(내부 실패)을 구분해야 하기 때문이다(2026-09-10 clarify).
 *       D3 대로 정상 입력에서 여기 오면 안 된다 — 오면 로그를 남긴다.</li>
 *   <li>조회 어댑터 부재·저장소 조회 실패·재산출 상한 소진은 예외로 던진다 → 500(FR-014).</li>
 *   <li>부수효과 없음. 조회 전용(FR-018).</li>
 * </ul>
 *
 * <h2>왜 mbid 가 아니라 {@code MusicDetail} 인가 (rev.3 서명 변경)</h2>
 *
 * <p>원격 엔진은 mbid 로 자기 번들에서 좌표를 찾았다. 인프로세스 산출은 축 좌표계
 * {@code u = (B − A)/|B − A|} 를 만들어야 하므로 <b>A·B 의 16차원 좌표</b>가 필요하고,
 * 같은 녹음 판정에는 A·B 의 {@code artist}·{@code title} 도 필요하다.
 *
 * <p>좌표를 산출 안에서 다시 조회하면 <b>산출이 저장소를 알게 되어</b> 층 경계가 깨지고,
 * 합성 좌표만으로 알고리즘을 검증할 수 없게 된다(SC-003·SC-004·SC-006). 호출부는 404 판정을 위해
 * 이미 {@code MusicDetail} 두 건을 들고 있으므로 그것을 넘긴다 — 추가 조회를 만들지 않는다.
 */
public interface JourneyPathFinder {

	/**
	 * 두 곡 사이 경로를 산출한다.
	 *
	 * @param start 출발곡. {@code location}(16축)과 {@code artist}·{@code title} 이 채워져 있어야 한다
	 * @param end   도착곡. 같은 조건
	 * @return 중간 정거장 목록과 메타. 경로를 못 만들면 {@code reachable == false}
	 */
	EnginePath find(MusicDetail start, MusicDetail end);
}
