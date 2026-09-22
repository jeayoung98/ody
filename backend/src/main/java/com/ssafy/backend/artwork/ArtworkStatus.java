package com.ssafy.backend.artwork;

/**
 * 작품의 평가 상태 (S15P21A405-563).
 *
 * <p>DB 는 문자열로 들고 있다({@code artwork.status}, CHECK 제약). 이름을 바꾸면 기존 행이 읽히지
 * 않으므로 DDL 의 CHECK 와 함께 바꾼다.
 */
public enum ArtworkStatus {

	/** 제출됐고 아직 평가 전. 소유자에게만 보인다. */
	PENDING,

	/** 점수가 붙었다. 리더보드에 서는 유일한 상태다. */
	SCORED,

	/** 평가가 실패했다. 점수는 비어 있다 — 0 이 아니다. */
	FAILED
}
