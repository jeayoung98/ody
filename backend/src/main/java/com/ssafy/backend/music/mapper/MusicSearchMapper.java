package com.ssafy.backend.music.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.MusicSearchRow;

/** 노래 검색 MyBatis 매퍼 ({@code MusicSearchReader} 어댑터가 쓰는 실행 계층). */
public interface MusicSearchMapper {

	/**
	 * title·artist 앞일치 결과를 관련성 순으로 돌려준다 (S15P21A405-234, 298).
	 *
	 * 부분일치(%q%)는 더 이상 하지 않는다 — 앞뒤 와일드카드는 어떤 B-tree 도 타지 못해
	 * 검색어와 무관하게 660만 행을 훑었다. 네 단계 모두 `=` 또는 `LIKE 'q%'` 라
	 * lower(title)·coalesce(lower(artist),'') 색인으로 0건이어도 즉시 끝난다.
	 *
	 * @param q      소문자로 내린 검색어 원문. 완전일치 비교용이라 LIKE 이스케이프를 하지 않는다
	 * @param prefix 소문자 + LIKE 이스케이프 + '%'. 앞일치 비교용
	 * @param cap    단계별로 미리 자를 행 수. offset + size 면 충분하다
	 */
	List<MusicSearchRow> findPage(@Param("q") String q,
			@Param("prefix") String prefix,
			@Param("cap") long cap,
			@Param("size") int size,
			@Param("offset") long offset);

	/** artist 또는 music+artist 앞일치 결과를 관련성 순으로 돌려준다. */
	List<MusicSearchRow> findFilteredPage(@Param("artist") String artist,
			@Param("artistPrefix") String artistPrefix,
			@Param("music") String music,
			@Param("musicPrefix") String musicPrefix,
			@Param("cap") long cap,
			@Param("size") int size,
			@Param("offset") long offset);
}
