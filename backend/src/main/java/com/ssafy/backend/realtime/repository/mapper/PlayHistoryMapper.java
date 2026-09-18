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
	 * 이 사용자가 마지막으로 재생한 곡 ID. 입장(join)이 클라 값을 그대로 믿지 않고 이걸로 대조한다.
	 * @return 마지막 재생곡 ID. 재생 기록이 없으면 null → 입장 거부(비노출 유지).
	 */
	Long findLatestMusicId(@Param("email") String email);
}
