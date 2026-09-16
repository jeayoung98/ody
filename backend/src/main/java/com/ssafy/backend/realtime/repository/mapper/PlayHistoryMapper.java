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
}
