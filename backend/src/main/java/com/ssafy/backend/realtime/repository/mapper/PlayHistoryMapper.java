package com.ssafy.backend.realtime.repository.mapper;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.realtime.dto.play.PlayHistoryRow;

/** 실시간 재생 기록을 DB에 저장하고 수정한다. */
public interface PlayHistoryMapper {

	/** 재생 로그 INSERT. selectKey(nextval)로 id 를 row 에 채워 돌려준다. */
	void insert(PlayHistoryRow row);

	/**
	 * played_ms 갱신(멱등, 소유자 검증).
	 * @return 영향 행 수 — 0 이면 대상 없음/비소유(잘못된 playHistoryId).
	 */
	int updatePlayedMs(@Param("id") long id, @Param("email") String email, @Param("playedMs") long playedMs);

	/**
	 * 재생 선언 1회당 music.play_cnt 를 1 올린다. DB 원자 증가라 동시 재생에도 유실이 없다.
	 * @return 영향 행 수 — 0 이면 해당 곡 없음(호출 전 findLocation 에서 이미 거른다).
	 */
	int incrementPlayCnt(@Param("musicId") long musicId);

	/**
	 * 곡별 최초 청취자를 기록한다 (S15P21A405-448). 이미 누가 들은 곡이면 아무것도 하지 않는다.
	 * 실제로 넣었으면 1 — 그 사람이 이 곡의 "발견자"다.
	 */
	int insertDiscovery(@Param("musicId") long musicId, @Param("email") String email);
}
