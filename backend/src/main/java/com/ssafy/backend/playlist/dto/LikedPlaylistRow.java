package com.ssafy.backend.playlist.dto;

import java.time.OffsetDateTime;

import lombok.Getter;
import lombok.Setter;

/** 좋아요한 플레이리스트 목록 row (MyBatis 결과 매핑 전용, mutable). S15P21A405-447. */
@Getter
@Setter
public class LikedPlaylistRow {

	private long id;
	private String name;
	private int musicCnt;
	private int likeCnt;
	private String ownerEmail;
	private String ownerNickname;
	private OffsetDateTime likedAt;
}
