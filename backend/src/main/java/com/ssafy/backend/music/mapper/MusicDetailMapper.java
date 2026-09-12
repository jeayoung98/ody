package com.ssafy.backend.music.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.dto.MusicGenreRow;

/** 노래 상세·주변곡 MyBatis 매퍼 ({@code MusicDetailReader} 어댑터가 쓰는 실행 계층). */
public interface MusicDetailMapper {

	/** 상세 1건. 없으면 null. */
	MusicDetailRow findById(@Param("id") long id);

	/**
	 * 질의 벡터로 쓸 좌표를 pgvector 자신의 텍스트 표기로 읽는다. 없으면 null.
	 * 텍스트를 그대로 되돌려 보내므로 파싱·재포맷이 없고 질의점이 저장값과 정확히 같다.
	 */
	String findLocationText(@Param("id") long id);

	/** 16차원 최근접 k곡. 자기 자신 제외, 거리 오름차순. qvec 은 findLocationText 가 준 값. */
	List<MusicDetailRow> findNearest(@Param("id") long id,
			@Param("qvec") String qvec,
			@Param("k") int k);

	/** 주어진 곡들의 장르. musicIdList 가 비면 호출하지 않는다(IN () 는 문법 오류). */
	List<MusicGenreRow> findGenresByMusicIds(@Param("musicIdList") List<Long> musicIdList);
}
