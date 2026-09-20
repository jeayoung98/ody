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
	 * 소리를 틀 수 있는 곡인지 확인한다.
	 *
	 * 곡마다 유튜브 영상을 찾아 둔 것이 있고, 찾아봤지만 쓸 만한 게 없다고 확정된 곡이 있다.
	 * 프론트가 이미 같은 값으로 판정하므로 여기서도 같은 값을 쓴다 — 기준이 둘로 갈리면 화면이 어긋난다.
	 *
	 * 아직 찾아보지 않은 곡은 틀 수 있다고 본다. 프론트도 그때는 일단 시도한다.
	 */
	boolean playable(long musicId);

	/**
	 * 여러 곡의 16차원 좌표를 읽는다.
	 * @param musicIds 곡 ID 목록
	 * @return 곡 ID별 좌표. 없는 곡은 결과에서 빠진다
	 */
	Map<Long, double[]> findLocations(List<Long> musicIds);
}
