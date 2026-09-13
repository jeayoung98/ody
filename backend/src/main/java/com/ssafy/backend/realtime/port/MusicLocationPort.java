package com.ssafy.backend.realtime.port;

import java.util.Optional;

/**
 * realtime 이 곡 좌표를 얻는 유일한 통로 (클라이언트 좌표 신뢰 x  뮤직아이디로 곡 좌표 받아서 CoordinateMapper로 계산)
 * realtime 이 music 매퍼에 직접 결합하지 않게 하는 경계.
 */
public interface MusicLocationPort {
	Optional<double[]> findLocation(long musicId);
}
