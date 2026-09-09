package com.ssafy.backend.music.search;

import java.util.List;

import com.ssafy.backend.music.dto.MusicSummary;

/**
 * 노래 검색 조회 port (정본 §3.1). BE2가 계약 소유, BE4가 인덱스·쿼리 실행 구현(헌법 X).
 *
 * 계약:
 * - 매칭: query가 곡명(title) 또는 아티스트명(artist)에 부분일치(substring), 대소문자 무시. 곡 단위 유일.
 * - 정렬: youtubeCnt 내림차순, 동률 시 id 오름차순.
 * - 페이징: page(0-based) * size offset에서 size건, 총 매칭 수(totalElements) 함께 반환.
 *
 * ponytail: 인터페이스만 정의. 어댑터 구현은 BE4 저장소 확정 후(B-D). 시그니처는 합의 전 제안이다.
 */
public interface MusicSearchReader {

	PageResult search(String query, int page, int size);

	record PageResult(List<MusicSummary> content, long totalElements) {
	}
}
