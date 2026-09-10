package com.ssafy.backend.playlist.dto;

import java.time.OffsetDateTime;

import lombok.Getter;
import lombok.Setter;

/** 플레이리스트 목록 조회 row (정본 §4.1). musicCnt는 playlist_music 조인 집계. */
@Getter
@Setter
public class PlaylistSummaryRow {

	private long id;
	private String name;
	private int musicCnt;
	private OffsetDateTime createdAt;
}
