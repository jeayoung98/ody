package com.ssafy.backend.realtime.service.music;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/** 곡 ID로 서버에 저장된 16차원 좌표를 찾는다. */
public interface MusicLocationService {
	/** 곡 하나의 좌표를 찾는다. */
	Optional<double[]> findLocation(long musicId);

	/**
	 * 여러 곡의 16차원 좌표를 읽는다.
	 * @param musicIds 곡 ID 목록
	 * @return 곡 ID별 좌표. 없는 곡은 결과에서 빠진다
	 */
	Map<Long, double[]> findLocations(List<Long> musicIds);
}
