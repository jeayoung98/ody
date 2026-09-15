package com.ssafy.backend.realtime.geometry;

/**
 * 원시 pc값을 -> 정규화 좌표(0~1)하고 → 격자 셀 번호로 변환 (FR-031)
 * 셀 계산은 반드시 Math.floor 를 먼저 하고 그 결과를 (int) 로 바꾼다.
 * 범위 밖은 가장자리 셀(0 / grid-1)로 지정
 */
public final class Normalizer {

	private Normalizer() {
	}

	/**
	 * 원시 pc값을 축의 [min, max] 기준으로 0~1 정규화 좌표로 변환한다.
	 * 범위 밖이면 (음수/1 초과가 나온다면), 그 처리는 {@link #cell(double, int)} 이 담당
	 * @param pc  원시 좌표값(해당 축의 PC 성분)
	 * @param min 해당 축의 정규화 하한(설정값)
	 * @param max 해당 축의 정규화 상한(설정값)
	 * @return 정규화값(0~1, 범위 밖 가능). max <= min(퇴화 축: 모든 곡이 같은 값)이면 0.5(중앙)로 방어.
	 */
	public static double normalize(double pc, double min, double max) {
		if (max <= min) {
			return 0.5;
		}
		return (pc - min) / (max - min);
	}

	/**
	 * 정규화 좌표를 격자 셀 번호로 변환한다. Math.floor 를 먼저 적용한 뒤 (int)로 변환
	 * @param xNorm 정규화 좌표(0~1, 범위 밖 가능)
	 * @param grid  축당 격자 칸 수(예: 16)
	 * @return 0 이상 grid-1 이하의 셀 번호
	 */
	public static int cell(double xNorm, int grid) {
		int idx = (int) Math.floor(xNorm * grid); // floor 먼저 — (int) 직접 캐스팅 금지
		if (idx < 0) {
			return 0;
		}
		if (idx >= grid) {
			return grid - 1;
		}
		return idx;
	}
}
