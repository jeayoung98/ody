package com.ssafy.backend.music.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.dto.MusicSearchRow;

/** 노래 검색 MyBatis 매퍼 ({@code MusicSearchReader} 어댑터가 쓰는 실행 계층). */
public interface MusicSearchMapper {

	/**
	 * title·artist ILIKE 부분일치 결과를 관련성 순으로 돌려준다 (S15P21A405-234).
	 *
	 * @param q       소문자로 내린 검색어 원문. 완전일치 비교용이라 LIKE 이스케이프를 하지 않는다
	 * @param prefix  소문자 + LIKE 이스케이프 + '%'. 앞일치 비교용
	 * @param pattern '%' + LIKE 이스케이프 + '%'. 부분일치 비교용
	 * @param cap     단계별로 미리 자를 행 수. offset + size 면 충분하다
	 */
	List<MusicSearchRow> findPage(@Param("q") String q,
			@Param("prefix") String prefix,
			@Param("pattern") String pattern,
			@Param("cap") long cap,
			@Param("size") int size,
			@Param("offset") long offset);

	/**
	 * 같은 조건으로 매칭이 하나라도 있는지 (S15P21A405-255).
	 *
	 * 총 건수를 세지 않는다 — 응답에 총 개수를 담지 않게 되면서 셀 이유가 없어졌고,
	 * COUNT 는 검색어와 무관하게 660만 행을 끝까지 세어 ~7초를 고정으로 먹었다.
	 */
	boolean existsMatch(@Param("pattern") String pattern);

	/** 주어진 곡들의 장르. musicIdList 가 비면 호출하지 않는다(IN () 는 문법 오류). */
	List<MusicGenreRow> findGenresByMusicIds(@Param("musicIdList") List<Long> musicIdList);
}
