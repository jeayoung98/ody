package com.ssafy.backend.realtime.service.music;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/** 곡 ID로 서버에 저장된 16차원 좌표를 찾는다. */
public interface MusicLocationService {
	/**
	 * 곡 하나의 좌표를 찾는다.
	 * 곡이 없는 경우와 곡은 있는데 좌표가 없는 경우를 구분하지 않는다 — 둘 다 empty.
	 * 구분이 필요하면 {@link #exists(long)} 로 한 번 더 확인한다.
	 */
	Optional<double[]> findLocation(long musicId);

	/**
	 * 곡이 존재하는지 확인한다. 좌표가 없어도 곡 자체가 있으면 true.
	 * 좌표 조회가 비었을 때 "없는 곡(404)"과 "지도에 못 놓는 곡(422)"을 가르는 데 쓴다.
	 */
	boolean exists(long musicId);

	/**
	 * 여러 곡의 16차원 좌표를 읽는다.
	 * @param musicIds 곡 ID 목록
	 * @return 곡 ID별 좌표. 없는 곡은 결과에서 빠진다
	 */
	Map<Long, double[]> findLocations(List<Long> musicIds);
}
