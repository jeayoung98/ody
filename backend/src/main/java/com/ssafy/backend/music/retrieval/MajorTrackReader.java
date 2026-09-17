package com.ssafy.backend.music.retrieval;

import java.util.List;

import com.ssafy.backend.music.dto.MapPoint;

/**
 * 지도 레이어 상주 집합 조회 port (T004).
 *
 * <p>서버는 <b>상주 집합</b>을 공간적으로 고르게 뽑아 돌려준다(D16). 인기순 대표곡 선별은
 * 하지 않는다 — 클라이언트가 화면 픽셀 격자에서 한다. 격자는 줌에 따라 변해 서버가 적용할 수 없다.
 *
 * <p>구현(T005·T016)이 지킬 것 — 근거는 data 스펙 16 {@code ingest/map_layer_queries.sql} 실측이다.
 * <ul>
 *   <li>{@code level=1} 은 미리 계산한 {@code map_sample} 을 읽는다. 전역 실시간 집계는 20,941 ms 다.</li>
 *   <li>{@code level>=2} 는 1겹 범위에 표현식 GiST({@code point(...) <@ box(...)}),
 *       <b>2겹부터는 {@code BETWEEN} heap 필터</b>를 건다. 둘 다 GiST 로 묶으면 플래너가
 *       {@code BitmapAnd} 로 145 ms → 355 ms 로 느려진다.</li>
 *   <li>전역 상위 k 를 먼저 자른 뒤 범위로 거르지 않는다(FR-013 MUST NOT). 범위 안의 곡이 누락된다.</li>
 *   <li>응답 좌표는 저장된 고정값 그대로다. 재계산·재투영하지 않는다(FR-007).</li>
 * </ul>
 *
 * <p>구현체는 아직 없다. 빈이 없으면 {@code MusicService} 가 {@code Optional} 로 받아
 * 미구현을 드러낸다 — 임시 스키마나 목 어댑터를 만들지 않는다.
 */
public interface MajorTrackReader {

	/**
	 * 조건에 해당하는 레이어 상주 집합을 돌려준다.
	 *
	 * @return 최대 {@code query.limit()} 개. 후보나 1레이어 정적 표본이 상한보다 적으면 가용 곡 전체를 반환한다.
	 *         순서는 의미를 갖지 않는다 —
	 *         표시 순위는 클라이언트가 {@code weight} 로 정한다(D16·D17).
	 */
	List<MapPoint> findResidentSet(MajorQuery query);
}
