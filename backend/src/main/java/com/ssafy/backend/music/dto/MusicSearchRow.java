package com.ssafy.backend.music.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * music 테이블 단건 row (MyBatis 결과 매핑 전용, mutable).
 *
 * 좌표는 저장된 {@code location vector(16)} 을 SELECT 에서 16축으로 펼쳐 그대로 받는다
 * (FR-006: 재계산·재투영 없음). genres 는 music_genre 조인이 따로 필요해 여기 없다.
 * youtubeUrl 도 없다 — 컬럼이 전 행 NULL 이라 읽지 않고 YoutubeSearchUrl 이 조회 시 만든다(D12).
 *
 * videoId 는 null 이면 MusicSearchReaderAdapter 가 실시간 조회를 시도한다(S15P21A405-312).
 */
@Getter
@Setter
public class MusicSearchRow {

	private Long id;
	private String title;
	private String artist;
	private String album;
	private String videoId;

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
