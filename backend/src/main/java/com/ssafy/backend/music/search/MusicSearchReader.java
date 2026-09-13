package com.ssafy.backend.music.search;

import java.util.List;

import com.ssafy.backend.music.dto.MusicSummary;

/**
 * 노래 검색 조회 port (정본 §3.1). BE2가 계약 소유, BE4가 인덱스·쿼리 실행 구현(헌법 X).
 *
 * 계약:
 * - 매칭: query가 곡명(title) 또는 아티스트명(artist)에 부분일치(substring), 대소문자 무시. 곡 단위 유일.
 * - 정렬: 관련성 순 (제목 완전일치 → 가수 완전일치 → 제목 앞일치 → 가수 앞일치 → 나머지 부분일치),
 *   같은 순위 안에서는 id 오름차순 (S15P21A405-234).
 * - 페이징: page(0-based) * size offset에서 size건, 다음 페이지 존재 여부(hasNext) 함께 반환.
 */
public interface MusicSearchReader {

	PageResult search(String query, int page, int size);

	/**
	 * 총 매칭 수는 담지 않는다 (S15P21A405-255). FE가 쓰지 않는데 세는 데만 ~7초가 들었다.
	 * hasNext 는 size+1 건을 떠서 초과분이 있었는지로 판단한다 — 세지 않고도 알 수 있다.
	 */
	record PageResult(List<MusicSummary> content, boolean hasNext) {
	}
}
