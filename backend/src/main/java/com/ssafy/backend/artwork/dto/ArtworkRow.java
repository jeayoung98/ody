package com.ssafy.backend.artwork.dto;

import java.time.OffsetDateTime;

import lombok.Getter;
import lombok.Setter;

/** "artwork" 테이블 단건 row (MyBatis 결과 매핑 전용, mutable). */
@Getter
@Setter
public class ArtworkRow {

	private long id;
	private long roundId;
	/** 제출자. */
	private String email;
	/** 출처 플레이리스트. FK 가 아니라 기록용이며 원본이 지워져도 남는다. */
	private Long playlistId;
	private String title;
	private String layoutVersion;
	/** {@link com.ssafy.backend.artwork.ArtworkStatus} 의 이름. */
	private String status;
	/** 평가 실패면 null 이다. 0 이 아니다. */
	private Integer score;
	private String aiComment;
	private String model;
	private int attemptCnt;
	private String failReason;
	private int likeCnt;
	private OffsetDateTime evaluatedAt;
	private OffsetDateTime createdAt;
}
