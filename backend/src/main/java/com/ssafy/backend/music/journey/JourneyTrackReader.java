package com.ssafy.backend.music.journey;

import java.util.List;

import com.ssafy.backend.music.dto.MusicDetail;

/**
 * 정거장 상세 일괄 조회 port (정본 §3.3). BE2가 계약 소유, BE4가 저장소 구현(헌법 X).
 *
 * <p>엔진은 정거장을 {@code mbid} 로만 주므로 응답에 필요한 MusicDetail 필드를 여기서 채운다.
 * 출발·도착곡은 이 port 를 쓰지 않는다 — {@code MusicDetailReader.findDetail(long id)} 결과가
 * mbid 원천이자 path 양 끝 원소이기 때문이다(research R3).
 *
 * <h2>계약</h2>
 * <ul>
 *   <li><b>순서를 보장하지 않는다.</b> SQL {@code IN} 은 입력 순서를 보존하지 않으므로,
 *       호출자가 mbid 키로 재조립한다. 순서의 원천은 엔진 응답이다(research R4, FR-005).</li>
 *   <li>요청한 mbid 중 없는 것은 <b>결과에서 빠진다</b>(예외 아님). 누락은 호출자가
 *       500 으로 처리한다 — 부분 경로를 성공으로 내지 않는다(FR-014).</li>
 *   <li>최대 20건(엔진 정거장 상한, D3). <b>한 번의 조회로</b> 처리한다 —
 *       곡당 왕복은 3초 예산을 넘긴다(SC-002).</li>
 *   <li>{@code location} 은 서빙 번들 좌표 원본을 그대로 준다. 반올림·재계산 없음(FR-016).</li>
 *   <li>부수효과 없음. 조회 전용(FR-018).</li>
 * </ul>
 *
 * <p>ponytail: 인터페이스만 정의. 어댑터({@code JourneyTrackMapper}, MyBatis)는 BE 곡 테이블에
 * 정수 {@code id} PK + {@code mbid} UNIQUE + {@code pc1}~{@code pc16}({@code real}) 이 생긴 뒤.
 */
public interface JourneyTrackReader {

	/**
	 * mbid 목록으로 곡 상세를 일괄 조회한다.
	 *
	 * @param mbids 조회할 mbid. 최대 20건
	 * @return 찾은 곡들. <b>순서 미보장</b>, 없는 mbid 는 빠진다
	 */
	List<MusicDetail> findDetailsByMbids(List<String> mbids);
}
