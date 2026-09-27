package com.ssafy.backend.music.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.MapPointRow;
import com.ssafy.backend.music.retrieval.LayerBox;

/** 지도 레이어 상주 집합 MyBatis 매퍼 ({@code MajorTrackReader} 어댑터가 쓰는 실행 계층). */
public interface MajorTrackMapper {

	/**
	 * 1레이어 정적 상주 집합. 미리 계산한 map_sample 을 읽고 요청 상한까지만 반환한다.
	 * 상한보다 표본이 적으면 가용 표본 전체를 반환한다.
	 */
	List<MapPointRow> findLayerOneSample(@Param("limit") int limit);

	/**
	 * 누적 범위에 드는 곡. boxes[0] 만 표현식 GiST, 나머지는 BETWEEN heap 필터다.
	 *
	 * @param boxes 레이어 1..level-1 의 사각 범위. 순서가 곧 레이어 순서다
	 */
	List<MapPointRow> findInAccumulatedBoxes(@Param("boxes") List<LayerBox> boxes, @Param("limit") int limit);
}
