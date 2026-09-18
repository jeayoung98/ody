package com.ssafy.backend.music.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * music 테이블 단건 row (MyBatis 결과 매핑 전용, mutable). 상세 1건과 주변곡이 같이 쓴다.
 *
 * 좌표는 저장된 {@code location vector(16)} 을 SELECT 에서 16축으로 펼쳐 그대로 받는다
 * (FR-006: 재계산·재투영 없음). genres 는 music_genre 조인이 따로 필요해 여기 없다.
 * youtubeUrl 도 없다 — 컬럼이 전 행 NULL 이라 읽지 않고 YoutubeSearchUrl 이 조회 시 만든다(D12).
 */
@Getter
@Setter
public class MusicDetailRow {

	private Long id;
	private String mbid;
	private String title;
	private String artist;
	private Double bpm;
	private Integer duration;
	private String album;
	/** music.release_year (smallint). 없으면 null. */
	private Integer releaseYear;
	private Integer playCnt;
	private Integer youtubeCnt;
	private String videoId;

	/** 주변곡 질의에서만 채워진다(상세 1건 조회에서는 null). */
	private Double distance;

	private double pc1;
	private double pc2;
	private double pc3;
	private double pc4;
	private double pc5;
	private double pc6;
	private double pc7;
	private double pc8;
	private double pc9;
	private double pc10;
	private double pc11;
	private double pc12;
	private double pc13;
	private double pc14;
	private double pc15;
	private double pc16;

	public Location toLocation() {
		return new Location(pc1, pc2, pc3, pc4, pc5, pc6, pc7, pc8,
				pc9, pc10, pc11, pc12, pc13, pc14, pc15, pc16);
	}
}
