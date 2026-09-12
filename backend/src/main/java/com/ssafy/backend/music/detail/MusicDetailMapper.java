package com.ssafy.backend.music.detail;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.dto.MusicGenreRow;

/**
 * 노래 상세·주변곡 MyBatis 매퍼 ({@code MusicDetailReader} 어댑터가 쓰는 실행 계층).
 *
 * 패키지 위치가 {@code *.mapper} 가 아닌 이유: {@code BackendApplication} 의
 * {@code @MapperScan("com.ssafy.backend.*.mapper")} 에 잡히면 이 인터페이스가 스프링 빈이 되고,
 * 그러면 저장소의 모든 {@code @WebMvcTest} 슬라이스가 SqlSessionFactory 부재로 죽는다.
 * 여기서는 빈을 만들지 않고 어댑터가 {@code SqlSession.getMapper()} 로 받는다 —
 * XML namespace 가 이 인터페이스를 바인딩하므로 타입 안전성은 같다.
 *
 * ponytail: 근본 해결은 @MapperScan 을 별도 @Configuration 으로 분리하는 것(BE-infra 소유).
 */
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
