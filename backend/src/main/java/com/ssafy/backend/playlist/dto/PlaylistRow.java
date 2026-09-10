package com.ssafy.backend.playlist.dto;

import java.time.OffsetDateTime;

import lombok.Getter;
import lombok.Setter;

/** "playlist" 테이블 단건 row (MyBatis 결과 매핑 전용, mutable). 소유자 검증·이름 변경 등에 쓴다. */
@Getter
@Setter
public class PlaylistRow {

	private long id;
	private String ownerEmail;
	private String name;
	private OffsetDateTime createdAt;
}
