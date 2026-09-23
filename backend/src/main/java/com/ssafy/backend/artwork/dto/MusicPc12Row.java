package com.ssafy.backend.artwork.dto;

import lombok.Getter;
import lombok.Setter;

/** 곡 하나의 pc1/pc2 (MyBatis 결과 매핑 전용, mutable). 최근접 곡 조회 결과. */
@Getter
@Setter
public class MusicPc12Row {

	private long musicId;
	private double pc1;
	private double pc2;
}
