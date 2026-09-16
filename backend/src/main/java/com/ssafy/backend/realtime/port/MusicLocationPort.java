package com.ssafy.backend.realtime.port;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * realtime 이 곡 좌표를 얻는 유일한 통로 (클라이언트 좌표 신뢰 x  뮤직아이디로 곡 좌표 받아서 CoordinateMapper로 계산)
 * realtime 이 music 매퍼에 직접 결합하지 않게 하는 경계.
 */
public interface MusicLocationPort {
	Optional<double[]> findLocation(long musicId);

	/**
	 * 여러 곡의 16차원 좌표를 읽는다.
	 * @param musicIds 곡 ID 목록
	 * @return 곡 ID별 좌표. 없는 곡은 결과에서 빠진다
	 */
	Map<Long, double[]> findLocations(List<Long> musicIds);
}
