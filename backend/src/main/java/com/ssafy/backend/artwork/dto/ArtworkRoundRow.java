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
	/** 회차당 한 사람이 남의 작품에 줄 수 있는 좋아요 수 (S15P21A405-616). DB 에서 고친다. */
	private int voteLimit;
	/** 순위 점수의 AI 가중치 K — AI 만점이 좋아요 몇 개인가 (S15P21A405-616). DB 에서 고친다. */
	private double aiWeight;
}
