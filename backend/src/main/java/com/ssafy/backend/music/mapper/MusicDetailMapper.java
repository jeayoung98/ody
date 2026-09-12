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

	/**
	 * mbid 목록으로 상세를 일괄 조회한다 (여정 정거장 조립용).
	 *
	 * <p><b>순서를 보장하지 않는다</b> — {@code IN} 은 입력 순서를 보존하지 않는다.
	 * 호출자가 mbid 키로 재조립한다. 없는 mbid 는 결과에서 빠진다(예외 아님).
	 */
	List<MusicDetailRow> findByMbids(@Param("mbidList") List<String> mbidList);

	/**
	 * id 목록으로 <b>좌표만</b> 일괄 조회한다 (별자리 배치용, BACKEND-NOTES A-9).
	 *
	 * <p>제목·아티스트·장르는 읽지 않는다 — 배치는 좌표만 있으면 된다.
	 * <b>좌표가 NULL 인 행은 결과에서 빠진다</b>: {@code MusicDetailRow} 의 pc 필드가 primitive 라
	 * NULL 이 0 으로 둔갑해 그 곡이 원점에 찍히면 모양이 조용히 달라진다. 빠뜨려서 호출자가 404 를 내게 한다.
	 *
	 * <p>순서를 보장하지 않는다. 없는 id 는 결과에서 빠진다(예외 아님). idList 가 비면 호출하지 않는다.
	 */
	List<MusicDetailRow> findLocationsByIds(@Param("idList") List<Long> idList);

	/**
	 * id 목록으로 상세를 일괄 조회한다 (플레이리스트 상세 조립용).
	 *
	 * <p><b>순서를 보장하지 않는다</b> — {@code IN} 은 입력 순서를 보존하지 않는다.
	 * 호출자가 id 키로 재조립한다. 없는 id 는 결과에서 빠진다(예외 아님).
	 */
	List<MusicDetailRow> findByIds(@Param("idList") List<Long> idList);

	/** 주어진 곡들의 장르. musicIdList 가 비면 호출하지 않는다(IN () 는 문법 오류). */
	List<MusicGenreRow> findGenresByMusicIds(@Param("musicIdList") List<Long> musicIdList);
}
