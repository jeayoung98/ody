package com.ssafy.backend.music.retrieval;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.MapPointRow;

/**
 * 지도 레이어 상주 집합 MyBatis 매퍼 ({@code MajorTrackReader} 어댑터가 쓰는 실행 계층).
 *
 * 패키지 위치가 {@code *.mapper} 가 아닌 이유: {@code BackendApplication} 의
 * {@code @MapperScan("com.ssafy.backend.*.mapper")} 에 잡히면 스프링 빈이 되고, 그러면 저장소의
 * 모든 {@code @WebMvcTest} 슬라이스가 SqlSessionFactory 부재로 죽는다(실측 63건).
 * 빈 없이 어댑터가 {@code SqlSession.getMapper()} 로 받는다 — XML namespace 가 바인딩한다.
 *
 * ponytail: 근본 해결(S15P21A405-232, @MapperScan 분리)은 MR !65 에 올라가 있다.
 * 그것이 backend/dev 에 머지되면 이 인터페이스를 {@code music.mapper} 로 옮기고 이 주석을 지운다.
 */
public interface MajorTrackMapper {

	/** 1레이어 정적 상주 집합. 미리 계산한 map_sample 을 읽는다(전역 실시간 집계는 20,941 ms). */
	List<MapPointRow> findLayerOneSample(@Param("limit") int limit);

	/**
	 * 누적 범위에 드는 곡. boxes[0] 만 표현식 GiST, 나머지는 BETWEEN heap 필터다.
	 *
	 * @param boxes 레이어 1..level-1 의 사각 범위. 순서가 곧 레이어 순서다
	 */
	List<MapPointRow> findInAccumulatedBoxes(@Param("boxes") List<LayerBox> boxes, @Param("limit") int limit);
}
