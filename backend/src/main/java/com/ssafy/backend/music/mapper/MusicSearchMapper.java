package com.ssafy.backend.music.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.dto.MusicSearchRow;

/** 노래 검색 MyBatis 매퍼 ({@code MusicSearchReader} 어댑터가 쓰는 실행 계층). */
public interface MusicSearchMapper {

	/** title·artist ILIKE 부분일치, youtube_cnt DESC(NULLS LAST)·id ASC, offset/limit. */
	List<MusicSearchRow> findPage(@Param("pattern") String pattern,
			@Param("size") int size,
			@Param("offset") long offset);

	/** 같은 조건의 총 매칭 수. */
	long countMatches(@Param("pattern") String pattern);

	/** 주어진 곡들의 장르. musicIdList 가 비면 호출하지 않는다(IN () 는 문법 오류). */
	List<MusicGenreRow> findGenresByMusicIds(@Param("musicIdList") List<Long> musicIdList);
}
