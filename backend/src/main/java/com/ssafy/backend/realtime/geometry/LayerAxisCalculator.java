package com.ssafy.backend.realtime.geometry;

import java.util.Optional;

/**
 * 레이어(줌 깊이) → 화면에 그릴 표시 축 2개.
 *
 * 곡 좌표는 16차원(location.pc1~pc16, PCA 결과)인데 지도는 2D라 한 번에 2축만 그린다.
 * PCA는 분산이 큰 순서로 축이 정렬돼 있어, 레이어가 깊어질수록 다음 축쌍(덜 지배적인 구조)을 본다.
 * 레이어 번호는 프론트와 같은 0-based 다(0 = 최상위 조망, 7 = 가장 깊은 겹). 레이어 l 은 (PC(2l+1), PC(2l+2)) 을 x·y 로 쓴다(FR-031).
 * 프론트가 받는 location = {pc1, pc2, ..., pc16}. 레이어 1이면 그 곡을 location.pc3(x), location.pc4(y)로 배치한다
 * — 프론트 엔진의 pc[2l]·pc[2l+1](0-based 배열)과 같은 축이다.
 * (반환하는 축 번호는 1-based라 프론트 pcN 키와 그대로 대응된다.)
 * 2026-09-18 1-based → 0-based 전환: 프론트 `useMapStore.layer`·`LayerBox.layer` 와 같은 번호를 쓰기 위해서다.
 * neighbors.distance 는 16차원 전체 공간에서 계산한 값이고, 화면엔 현재 레이어의 2축만 투영해 보여준다.
 *
 * 순수 함수. 유효 레이어 상한(maxLayer)은 호출자가 넘긴다
 * (PC 차원 16 → 최대 8레이어. 데이터 버전에 종속되므로 설정에서 온다).
 */
public final class LayerAxisCalculator {

	private LayerAxisCalculator() {
	}

	/**
	 * 레이어 번호를 표시 축 쌍으로 변환한다. 레이어 l → (PC(2l+1), PC(2l+2)).
	 * 예) findAxes(0, 8) = [1, 2] → location.pc1·pc2, findAxes(1, 8) = [3, 4] → location.pc3·pc4.
	 *
	 * @param layer    0-based 레이어 번호(0 = 최상위 조망 레이어)
	 * @param maxLayer 레이어 수(= PC차원 / 2, 예: 16차원이면 8). 유효 범위는 0 ~ maxLayer-1
	 * @return (axisX, axisY) = (2l+1, 2l+2) 1-based PC 축 번호. 범위 밖이면 empty.
	 */
	public static Optional<int[]> findAxes(int layer, int maxLayer) {
		if (layer < 0 || layer >= maxLayer) {
			return Optional.empty();
		}
		return Optional.of(new int[] {2 * layer + 1, 2 * layer + 2});
	}
}
