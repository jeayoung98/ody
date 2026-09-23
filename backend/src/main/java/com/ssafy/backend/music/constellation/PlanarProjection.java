package com.ssafy.backend.music.constellation;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 곡 집합의 16차원 좌표를 2D 배치로 누른다 (PATH-01, BACKEND-NOTES A-9).
 *
 * <p><b>pc1 → x, pc2 → y 고정축</b>이다 (S15P21A405-595). 집합의 pc1·pc2 평균을 원점으로 옮기고
 * 두 축에 <b>같은 배율</b>을 적용해 최대 절댓값이 1 이 되게 맞춘다. 축별로 따로 늘리면 모양이 찌그러진다.
 *
 * <h2>왜 집합별 PCA 를 버렸나</h2>
 * 이전 구현(S15P21A405-265)은 그 집합만의 분산이 가장 큰 두 방향(공분산 상위 고유벡터)에 투영했다.
 * 임의 집합을 화면에 넓게 펼치는 데는 좋았지만, <b>사용자가 모양을 의도해 만들 수 없었다</b> — 지도
 * 1레이어(pc1/pc2)에서 고양이 자리에 곡을 골라도 집합 PCA 가 다른 축을 잡으면 고양이가 풀린다.
 * 작품을 만드는 좌표계와 채점하는 좌표계가 같아야 하므로 지도 1레이어 좌표를 그대로 쓴다.
 * 레이어와 무관한 고정 배치라는 PATH-01 요구는 그대로다 — pc1/pc2 는 어느 레이어에서 열어도 같다.
 *
 * <h2>같은 곡 집합이면 항상 같은 좌표다</h2>
 * 평균과 최대값만 쓰므로 순서에 따른 부동소수 오차가 끼어들 자리가 거의 없지만, 누적 전에 {@code musicId}
 * 오름차순으로 세워 그마저 없앤다. 고유분해가 없으니 부호 규약도 필요 없다 — pc1 양수가 오른쪽, pc2 양수가
 * 위다(지도와 같다).
 *
 * <p>Spring·DB 에 의존하지 않는 순수 계산이다.
 */
public final class PlanarProjection {

	/** 좌표 차원. {@code MapPoint.PC_DIMS}·서빙 manifest 와 같아야 한다. */
	public static final int DIMS = 16;

	/** x 로 쓰는 축(0-based). 지도 1레이어의 가로축 pc1. */
	public static final int AXIS_X = 0;

	/** y 로 쓰는 축(0-based). 지도 1레이어의 세로축 pc2. */
	public static final int AXIS_Y = 1;

	/** 퍼뜨릴 거리가 없다고 볼 기준. 이보다 작으면 0 으로 나누지 않고 전부 원점에 둔다. */
	private static final double SPAN_EPS = 1e-9;

	/** 배치 좌표 한 점. {@code x}·{@code y} 는 -1 ~ 1. */
	public record Point(double x, double y) {
	}

	private PlanarProjection() {
	}

	/**
	 * 곡별 16차원 좌표를 pc1/pc2 평면의 2D 배치로 옮긴다.
	 *
	 * @param coords 곡 id → 16칸 좌표. <b>입력 배열을 변형하지 않는다.</b>
	 * @return 곡 id → 배치 점. 입력과 같은 곡이 모두 들어 있다
	 * @throws IllegalArgumentException 좌표가 null 이거나 16칸이 아닐 때
	 */
	public static Map<Long, Point> project(Map<Long, double[]> coords) {
		long[] ids = coords.keySet().stream().mapToLong(Long::longValue).sorted().toArray();
		int n = ids.length;
		if (n == 0) {
			return Map.of();
		}

		double[] xs = new double[n];
		double[] ys = new double[n];
		double meanX = 0;
		double meanY = 0;
		for (int i = 0; i < n; i++) {
			double[] src = coords.get(ids[i]);
			if (src == null || src.length != DIMS) {
				throw new IllegalArgumentException("좌표는 %d칸이어야 한다 (musicId=%d): %s"
						.formatted(DIMS, ids[i], src == null ? "null" : src.length));
			}
			xs[i] = src[AXIS_X];
			ys[i] = src[AXIS_Y];
			meanX += xs[i];
			meanY += ys[i];
		}
		meanX /= n;
		meanY /= n;

		double span = 0;
		for (int i = 0; i < n; i++) {
			xs[i] -= meanX;
			ys[i] -= meanY;
			span = Math.max(span, Math.max(Math.abs(xs[i]), Math.abs(ys[i])));
		}

		Map<Long, Point> out = new LinkedHashMap<>();
		if (span < SPAN_EPS) {
			// 퍼뜨릴 거리가 없다(모든 곡의 pc1·pc2 가 같다). 오류가 아니라 한 점으로 모은다.
			for (long id : ids) {
				out.put(id, new Point(0, 0));
			}
			return out;
		}
		for (int i = 0; i < n; i++) {
			out.put(ids[i], new Point(xs[i] / span, ys[i] / span));
		}
		return out;
	}
}
