package com.ssafy.backend.realtime.nearby.port;

import java.util.List;

/**
 * "내 곡이랑 비슷한 곡들"을 가져오는 통로.
 * 이 계산은 BE2(주변 곡 찾기)가 이미 만들어놨으니 우리는 그걸 부르기만 한다
 * 우리 코드가 BE2 코드에 바로 달라붙지 않게 이 인터페이스를 하나 사이에 둔다. 테스트할 땐 이걸 가짜로 바꿔 낀다.
 */
public interface NeighborPort {

	/**
	 * 내가 듣는 곡 + 그 곡이랑 비슷한 곡 K개를 가까운 순서로 가져온다. 내 곡이 거리 0으로 맨 앞에 온다.
	 *
	 * @param anchorMusicId 내가 지금 듣는 곡 id
	 * @return 각 곡의 id·제목·가수·곡 좌표(숫자 16개)·내 곡과의 거리
	 * @throws com.ssafy.backend.common.CustomException 그 곡을 못 찾으면 MUSIC_NOT_FOUND
	 *         (내가 실제로 튼 곡을 기준으로 부르면 이럴 일은 없음)
	 */
	List<NeighborSong> anchorAndNeighbors(long anchorMusicId);

	/** 곡 하나: id · 제목 · 가수 · 곡 좌표(숫자 16개, 첫 칸이 PC1) · 내 곡과 떨어진 거리(내 곡 자신은 0). */
	record NeighborSong(long musicId, String title, String artist, double[] pc, double distance) {
	}
}
