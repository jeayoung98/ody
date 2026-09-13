package com.ssafy.backend.music.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.dto.MusicGenreRow;

/** 노래 상세·주변곡 MyBatis 매퍼 ({@code MusicDetailReader} 어댑터가 쓰는 실행 계층). */
public interface MusicDetailMapper {

	/** id 로 상세 1건. 없으면 {@code null}. */
	MusicDetailRow findById(@Param("id") long id);

	/** 곡의 좌표를 pgvector 리터럴 문자열로. 없으면 {@code null}. */
	String findLocationText(@Param("id") long id);

	/**
	 * mbid 목록으로 상세를 일괄 조회한다 (여정 정거장 조립용).
	 *
	 * <p><b>순서를 보장하지 않는다</b> — {@code IN} 은 입력 순서를 보존하지 않는다.
	 * 호출자가 mbid 키로 재조립한다. 없는 mbid 는 결과에서 빠진다(예외 아님).
	 */
	List<MusicDetailRow> findByMbids(@Param("mbidList") List<String> mbidList);

	/** 주어진 곡들의 장르. musicIdList 가 비면 호출하지 않는다(IN () 는 문법 오류). */
	List<MusicGenreRow> findGenresByMusicIds(@Param("musicIdList") List<Long> musicIdList);
}
