package com.ssafy.backend.music.search;

import java.util.List;

import com.ssafy.backend.music.dto.MusicSummary;

/**
 * 노래 검색 조회 port (정본 §3.1). BE2가 계약 소유, BE4가 인덱스·쿼리 실행 구현(헌법 X).
 *
 * 계약:
 * - 매칭: query 통합 검색, artist 단독 검색, music+artist 교집합 검색. 모두 **앞일치**·대소문자 무시이며 곡 단위 유일.
 *   부분일치(substring)는 2026-09-14에 뺐다 (S15P21A405-298) — 앞뒤 와일드카드 %q%는 어떤 B-tree도
 *   타지 못해 검색어와 무관하게 660만 행을 훑었다. 대가로 'beatles'가 'The Beatles'를 못 찾는다.
 * - 정렬: 조건별 완전일치를 앞일치보다 우선하고, 같은 순위 안에서는 id 오름차순 (S15P21A405-234, 365).
 * - 페이징: page(0-based) * size offset에서 size건, 다음 페이지 존재 여부(hasNext) 함께 반환.
 */
public interface MusicSearchReader {

	PageResult search(MusicSearchCondition condition, int page, int size);

	/**
	 * 총 매칭 수는 담지 않는다 (S15P21A405-255). FE가 쓰지 않는데 세는 데만 ~7초가 들었다.
	 * hasNext 는 size+1 건을 떠서 초과분이 있었는지로 판단한다 — 세지 않고도 알 수 있다.
	 */
	record PageResult(List<MusicSummary> content, boolean hasNext) {
	}
}
