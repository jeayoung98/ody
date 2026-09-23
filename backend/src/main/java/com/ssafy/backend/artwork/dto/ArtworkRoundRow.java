package com.ssafy.backend.artwork.dto;

import java.time.OffsetDateTime;

import lombok.Getter;
import lombok.Setter;

/** "artwork_round" 단건 row (MyBatis 결과 매핑 전용, mutable). */
@Getter
@Setter
public class ArtworkRoundRow {

	private long id;
	private String theme;
	/** AI 에게 그대로 넘기는 채점 기준 문장. 코드 배포 없이 DB 에서 고친다. */
	private String themePrompt;
	private OffsetDateTime startsAt;
	private OffsetDateTime endsAt;
}
