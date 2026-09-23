package com.ssafy.backend.artwork.dto;

import java.time.OffsetDateTime;

import lombok.Getter;
import lombok.Setter;

/**
 * 리더보드·내 작품 목록의 row (MyBatis 결과 매핑 전용, mutable).
 *
 * <p>{@code musicCnt} 와 {@code likedByMe} 는 테이블 칼럼이 아니라 조회 때 함께 계산한다 —
 * 목록 한 번에 곡 수를 세러 또 왕복하지 않는다.
 */
@Getter
@Setter
public class ArtworkSummaryRow {

	private long id;
	private String title;
	private String email;
	private String status;
	private Integer score;
	private String aiComment;
	private String failReason;
	private int likeCnt;
	private int musicCnt;
	private boolean likedByMe;
	/** 리더보드에서만 계산한다 (S15P21A405-616). 내 작품 목록에서는 null. */
	private Double rankScore;
	private OffsetDateTime createdAt;
}
