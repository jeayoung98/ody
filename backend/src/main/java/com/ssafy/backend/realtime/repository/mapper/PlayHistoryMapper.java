package com.ssafy.backend.realtime.repository.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.realtime.dto.play.PlayHistoryRow;

/** 실시간 재생 기록을 DB에 저장하고 수정한다. */
public interface PlayHistoryMapper {

	/** 재생 로그 INSERT. selectKey(nextval)로 id 를 row 에 채워 돌려준다. */
	void insert(PlayHistoryRow row);

	/**
	 * 재생 기록에 붙일 번호를 필요한 개수만큼 미리 받아온다.
	 *
	 * 넣고 나서 받지 않고 먼저 받는 이유는, 곡을 옮길 때 각자의 기록 번호를 Redis 에도
	 * 같이 적어 둬야 하기 때문이다. 미리 알고 있으면 DB 에 넣는 일과 Redis 에 적는 일의
	 * 순서를 자유롭게 짤 수 있다.
	 */
	List<Long> nextIds(@Param("count") int count);

	/**
	 * 재생 기록 여러 줄을 한 번에 넣는다.
	 *
	 * 인솔자와 따라가는 사람들이 같이 곡을 옮기면 한 번에 21줄까지 생긴다.
	 * 한 줄씩 넣으면 DB를 21번 왕복한다.
	 *
	 * 번호는 {@link #nextIds(int)} 로 미리 받아 채워 넣어야 한다.
	 */
	void insertBatch(@Param("rows") List<PlayHistoryRow> rows);

	/**
	 * 재생 선언 1회당 music.play_cnt 를 1 올린다. DB 원자 증가라 동시 재생에도 유실이 없다.
	 * @return 영향 행 수 — 0 이면 해당 곡 없음(호출 전 findLocation 에서 이미 거른다).
	 */
	int incrementPlayCnt(@Param("musicId") long musicId);

	/**
	 * 곡의 재생수를 한 번에 여러 개 올린다.
	 *
	 * 여럿이 같은 곡으로 함께 옮겨가면 +1 을 사람 수만큼 반복하게 된다.
	 * 같은 줄을 여러 번 고치면 서로 차례를 기다리느라 느려진다. 한 번에 더한다.
	 */
	int incrementPlayCntBy(@Param("musicId") long musicId, @Param("delta") int delta);

	/**
	 * 이 사용자가 마지막으로 재생한 곡 ID. 입장(join)이 클라 값을 그대로 믿지 않고 이걸로 대조한다.
	 * @return 마지막 재생곡 ID. 재생 기록이 없으면 null → 입장 거부(비노출 유지).
	 */
	Long findLatestMusicId(@Param("email") String email);

	/**
	 * 곡별 최초 청취자를 기록한다 (S15P21A405-448). 이미 누가 들은 곡이면 아무것도 하지 않는다.
	 * 실제로 넣었으면 1 — 그 사람이 이 곡의 "발견자"다.
	 */
	int insertDiscovery(@Param("musicId") long musicId, @Param("email") String email);
}
