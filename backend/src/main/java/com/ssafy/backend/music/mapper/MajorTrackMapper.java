package com.ssafy.backend.music.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.music.dto.MapPointRow;
import com.ssafy.backend.music.retrieval.LayerBox;

/** 지도 레이어 상주 집합 MyBatis 매퍼 ({@code MajorTrackReader} 어댑터가 쓰는 실행 계층). */
public interface MajorTrackMapper {

	/**
	 * 1레이어 정적 상주 집합. 미리 계산한 map_sample 을 읽는다(전역 실시간 집계는 20,941 ms).
	 * 이미 화면 크기로 계산된 집합이라 limit 을 받지 않는다 — 자르면 첫 화면 별이 사라진다(실측 1,094칸).
	 */
	List<MapPointRow> findLayerOneSample();

	/**
	 * 누적 범위에 드는 곡. boxes[0] 만 표현식 GiST, 나머지는 BETWEEN heap 필터다.
	 *
	 * @param boxes 레이어 1..level-1 의 사각 범위. 순서가 곧 레이어 순서다
	 */
	List<MapPointRow> findInAccumulatedBoxes(@Param("boxes") List<LayerBox> boxes, @Param("limit") int limit);
}
