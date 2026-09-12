package com.ssafy.backend.music.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.TrackCandidateRow;

/**
 * 좌표 최근접 MyBatis 매퍼 ({@code NearestTrackReader} 어댑터가 쓰는 실행 계층).
 *
 * <p>여정 층 후보(004)와 주변 탐색 이웃(005)이 같은 질의를 쓴다.
 */
public interface NearestTrackMapper {

	/**
	 * {@code hnsw.ef_search} 를 이 트랜잭션 동안만 올린다.
	 *
	 * <p><b>2026-09-12 운영 실측.</b> 기본값이 40 이라 {@code LIMIT 200} 을 요청해도 <b>40행만 온다</b>
	 * (HNSW 가 {@code ef_search} 개를 훑고 멈춘다). limit 을 400·800 으로 올려도 소용없다 — 그래서
	 * 재질의로는 풀리지 않고 이 설정이 필요하다.
	 *
	 * <p>비용은 웜 기준 1.2ms → 4.0ms 다. 층 20개면 80ms 로 예산 안이다.
	 * <b>콜드는 350ms</b> 였다 — 첫 요청이나 인덱스가 캐시에서 밀린 뒤에 그만큼 난다(B-Latency).
	 */
	void raiseEfSearch(@Param("efSearch") int efSearch);

	/**
	 * 질의 좌표에서 가장 가까운 곡을 거리 오름차순으로.
	 *
	 * @param point 16차원 좌표를 {@code [a,b,...]} 형태로 적은 문자열. <b>바인드 파라미터로 넘긴다</b>
	 */
	List<TrackCandidateRow> findNearest(@Param("point") String point, @Param("limit") int limit);
}
