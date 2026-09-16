package com.ssafy.backend.feedback.dto;

import lombok.Getter;
import lombok.Setter;

/** GET /api/feedback/answered 한 건. 문항 키(mode, anchor, prev, music)와 답. */
@Getter
@Setter
public class AnsweredRow {

	private String mode;
	private long anchorMusicId;
	private Long prevMusicId;
	private long musicId;
	private boolean verdict;
}
