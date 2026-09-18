package com.ssafy.backend.stats.dto;

import lombok.Getter;
import lombok.Setter;

/** 주간 랭킹 집계 row (MyBatis 결과 매핑 전용, mutable). S15P21A405-448. */
@Getter
@Setter
public class RankedUserRow {

	private String email;
	private String nickname;
	private String imageUrl;
	private int count;
}
