package com.ssafy.backend.artwork.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * 곡 pc1/pc2 의 분포 범위 (MyBatis 결과 매핑 전용, mutable).
 *
 * <p>min/max 가 아니라 <b>백분위</b>다 — 극단값 몇 곡이 상자를 늘려 놓으면 템플릿이 곡 없는 빈 곳에
 * 놓인다. 템플릿은 이 상자 안에 들어간다.
 */
@Getter
@Setter
public class Pc12BoundsRow {

	private double xMin;
	private double xMax;
	private double yMin;
	private double yMax;
}
