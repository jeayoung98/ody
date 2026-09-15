package com.ssafy.backend.feedback.dto;

import lombok.Getter;
import lombok.Setter;

/** explore_feedback 한 행 (MyBatis 파라미터). 컬럼명은 db/explore_feedback.sql 과 1:1. */
@Getter
@Setter
public class FeedbackRow {

	private String sessionId;
	private String anonymousId;
	private String mode;
	private int rank;
	private long anchorMusicId;
	private Long targetMusicId;
	private Long prevMusicId;
	private long musicId;
	private Boolean verdict;
	private String reason;
	private Integer listenedSec;
	private boolean skipped;
	private String userEmail;
	private String bundle;
	private String rules;
}
