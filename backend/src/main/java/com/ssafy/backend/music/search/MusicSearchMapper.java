package com.ssafy.backend.music.search;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.dto.MusicSearchRow;

/**
 * 노래 검색 MyBatis 매퍼 ({@code MusicSearchReader} port 어댑터가 쓰는 실행 계층).
 *
 * 패키지 위치가 {@code *.mapper} 가 아닌 이유: {@code BackendApplication} 의
 * {@code @MapperScan("com.ssafy.backend.*.mapper")} 에 잡히면 이 인터페이스가 스프링 빈이 되고,
 * 그러면 저장소의 모든 {@code @WebMvcTest} 슬라이스가 SqlSessionFactory 부재로 죽는다
 * (매퍼가 늘 때마다 슬라이스 테스트 10개에 @MockitoBean 을 한 줄씩 더해야 한다).
 * 여기서는 빈을 만들지 않고 어댑터가 {@code SqlSession.getMapper()} 로 받는다 —
 * XML namespace 가 이 인터페이스를 바인딩하므로 타입 안전성은 같다.
 *
 * ponytail: 근본 해결은 T301(@MapperScan 을 별도 @Configuration 으로 분리, BE-infra 소유).
 * 그게 되면 이 인터페이스를 {@code music.mapper} 로 옮기고 다른 매퍼들과 같은 모양으로 되돌린다.
 */
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
