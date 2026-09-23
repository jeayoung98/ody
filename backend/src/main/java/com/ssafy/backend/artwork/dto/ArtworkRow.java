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
	/** 제출자 닉네임. {@code findById} 만 채운다 (S15P21A405-645). */
	private String ownerNickname;
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
	/** 채점 기준 그림이면 true. 사람이 넣는 행이고 리더보드에 서지 않는다. */
	private boolean anchor;
	/** 닫힌 모양 — 마지막 곡과 첫 곡을 잇는다 (S15P21A405-616). 출품 스냅샷. */
	private boolean closed;
	private OffsetDateTime evaluatedAt;
	private OffsetDateTime createdAt;
}
