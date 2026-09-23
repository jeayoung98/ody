package com.ssafy.backend.common;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * 별자리 작품 도메인 에러 (S15P21A405-563).
 *
 * <p>{@code ARTWORK_NOT_FOUND} 는 "없는 작품" 과 "남의 미채점 작품" 둘 다에 쓴다. 후자를 403 으로
 * 내면 그 작품이 존재한다는 사실이 새기 때문이다.
 */
@Getter
public enum ArtworkErrorCode implements ErrorCode {

	ARTWORK_NOT_FOUND(HttpStatus.NOT_FOUND, "ARTWORK_NOT_FOUND", "존재하지 않는 작품입니다."),
	ARTWORK_ROUND_CLOSED(HttpStatus.CONFLICT, "ARTWORK_ROUND_CLOSED", "지금 열려 있는 회차가 없습니다."),
	ARTWORK_NOT_FAILED(HttpStatus.CONFLICT, "ARTWORK_NOT_FAILED", "평가에 실패한 작품만 다시 평가할 수 있습니다."),
	ARTWORK_RETRY_EXHAUSTED(HttpStatus.CONFLICT, "ARTWORK_RETRY_EXHAUSTED", "재평가 횟수를 모두 사용했습니다."),
	/** 회차당 좋아요 한도를 다 썼다 (S15P21A405-616). 하나를 거두면 다시 줄 수 있다. */
	ARTWORK_VOTE_LIMIT(HttpStatus.CONFLICT, "ARTWORK_VOTE_LIMIT", "이번 회차 좋아요를 모두 썼습니다."),
	/** 내 작품에는 좋아요를 줄 수 없다 (S15P21A405-616). */
	ARTWORK_VOTE_SELF(HttpStatus.BAD_REQUEST, "ARTWORK_VOTE_SELF", "내 작품에는 좋아요를 줄 수 없습니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;

	ArtworkErrorCode(HttpStatus httpStatus, String code, String message) {
		this.httpStatus = httpStatus;
		this.code = code;
		this.message = message;
	}
}
