package com.ssafy.backend.realtime.play.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * "play_history" 테이블 단건 row (MyBatis, mutable). id 는 insert 시 selectKey 로 채워진다.
 * play_history 는 FK 없음(email 은 varchar, user FK 아님) → 실 유저 없어도 INSERT 가능.
 * played_at 은 DB DEFAULT now(). played_ms 는 INT NOT NULL → 시작 시 0, playEnd 에서 갱신.
 */
@Getter
@Setter
public class PlayHistoryRow {

	private long id;
	private long musicId;
	private String email;    // users.email (탈퇴 시 NULL 익명화). auth 상황에선 Principal 이메일
	private String source;   // MAP / JOURNEY / PLAYLIST / FOLLOW
	private long playedMs;   // 재생 시간(ms). 시작 0 → playEnd 에서 실제값
}
