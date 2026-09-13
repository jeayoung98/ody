package com.ssafy.backend.realtime.mapper;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.realtime.play.dto.PlayHistoryRow;

/**
 * play_history 접근 (RT-02, S15P21A405-272). playlist 와 동일 패턴: id 는 앱이 시퀀스로 채운다.
 * 패키지가 realtime.mapper 인 이유: @MapperScan("com.ssafy.backend.*.mapper") 가 한 단계만 매칭해
 * realtime.play.mapper 는 안 잡히기 때문.
 */
public interface PlayHistoryMapper {

	/** 재생 로그 INSERT. selectKey(nextval)로 id 를 row 에 채워 돌려준다. */
	void insert(PlayHistoryRow row);

	/**
	 * played_ms 갱신(멱등, 소유자 검증).
	 * @return 영향 행 수 — 0 이면 대상 없음/비소유(잘못된 playHistoryId).
	 */
	int updatePlayedMs(@Param("id") long id, @Param("email") String email, @Param("playedMs") long playedMs);
}
