package com.ssafy.backend.music.constellation;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 곡 집합의 16차원 좌표를 2D 배치로 누른다 (PATH-01, BACKEND-NOTES A-9).
 *
 * <p>그 집합만의 분산이 가장 큰 두 방향(= 공분산 행렬의 상위 두 고유벡터)에 투영하고,
 * 두 축에 <b>같은 배율</b>을 적용해 최대 절댓값이 1 이 되게 맞춘다. 축별로 따로 늘리면 모양이 찌그러진다.
 *
 * <h2>같은 곡 집합이면 항상 같은 좌표여야 한다</h2>
 * 여러 사용자가 같은 플레이리스트를 같은 모양으로 봐야 하므로(FR-004~FR-006) 세 곳에서 결정성을 만든다.
 * <ol>
 *   <li><b>정렬</b> — 누적 전에 {@code musicId} 오름차순으로 세운다. {@code double} 덧셈은 결합법칙이
 *       성립하지 않아 요청 순서대로 더하면 {@code [A,B,C]} 와 {@code [C,B,A]} 의 공분산이 마지막 비트에서
 *       갈리고, 그 차이를 고유벡터가 확대한다.</li>
 *   <li><b>Jacobi 고유분해</b> — 거듭제곱 반복과 달리 반복 횟수에 결과가 의존하지 않는다. 상위 두 고유값이
 *       가까울 때 축이 시작 벡터 쪽으로 치우치는 문제가 없다.</li>
 *   <li><b>부호 규약</b> — 고유벡터는 {@code v} 와 {@code -v} 가 모두 해다. 절댓값이 가장 큰 성분(동률이면
 *       낮은 인덱스)을 양수로 만들어, 같은 집합이 좌우·상하로 뒤집혀 나오지 않게 한다.</li>
 * </ol>
 *
 * <p>Spring·DB 에 의존하지 않는 순수 계산이다.
 *
 * <p>ponytail: 고유값이 정확히 동률이면(λ2 == λ3) 어느 축을 2번째로 고를지 수학적으로 정할 수 없다.
 * 여기서는 "고유값 내림차순, 동률이면 인덱스 오름차순" 으로 결정적으로 고르지만, 그 경우 "그 집합의 모양"
 * 보장은 약해진다. 실수 좌표에서 정확한 동률은 사실상 나오지 않는다.
 */
public final class PlanarProjection {

	/** 좌표 차원. {@code MapPoint.PC_DIMS}·서빙 manifest 와 같아야 한다. */
	public static final int DIMS = 16;

	/** 퍼뜨릴 방향이 없다고 볼 기준. 이보다 작으면 0 으로 나누지 않고 전부 원점에 둔다. */
	private static final double SPAN_EPS = 1e-9;

	/** Jacobi 스윕 상한. 16x16 대칭 행렬은 보통 5~10 스윕이면 수렴한다. */
	private static final int MAX_SWEEPS = 50;

	/** 비대각 성분 제곱합이 전체 제곱합 대비 이 비율 아래면 수렴으로 본다(스케일 무관). */
	private static final double OFF_RATIO = 1e-18;

	/** 배치 좌표 한 점. {@code x}·{@code y} 는 -1 ~ 1. */
	public record Point(double x, double y) {
	}

	private PlanarProjection() {
	}

	/**
	 * 곡별 16차원 좌표를 2D 배치로 투영한다.
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

		double[][] rows = centered(coords, ids);
		double[][] cov = covariance(rows);

		// jacobi 는 cov 를 대각화한다 — 반환 후 cov 의 대각이 고유값, v 의 열이 고유벡터다.
		double[][] v = jacobi(cov);
		int[] top = topTwoAxes(cov);
		double[] axisX = signed(column(v, top[0]));
		double[] axisY = signed(column(v, top[1]));

		double[] xs = new double[n];
		double[] ys = new double[n];
		double span = 0;
		for (int i = 0; i < n; i++) {
			xs[i] = dot(rows[i], axisX);
			ys[i] = dot(rows[i], axisY);
			span = Math.max(span, Math.max(Math.abs(xs[i]), Math.abs(ys[i])));
		}

		Map<Long, Point> out = new LinkedHashMap<>();
		if (span < SPAN_EPS) {
			// 퍼뜨릴 방향이 없다(모든 곡의 좌표가 같다). 오류가 아니라 한 점으로 모은다.
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

	/** id 오름차순으로 좌표를 복사하고 차원별 평균을 뺀다. 입력 배열은 건드리지 않는다. */
	private static double[][] centered(Map<Long, double[]> coords, long[] ids) {
		int n = ids.length;
		double[][] rows = new double[n][];
		for (int i = 0; i < n; i++) {
			double[] src = coords.get(ids[i]);
			if (src == null || src.length != DIMS) {
				throw new IllegalArgumentException("좌표는 %d칸이어야 한다 (musicId=%d): %s"
						.formatted(DIMS, ids[i], src == null ? "null" : src.length));
			}
			rows[i] = src.clone();
		}

		double[] mean = new double[DIMS];
		for (double[] row : rows) {
			for (int d = 0; d < DIMS; d++) {
				mean[d] += row[d];
			}
		}
		for (int d = 0; d < DIMS; d++) {
			mean[d] /= n;
		}
		for (double[] row : rows) {
			for (int d = 0; d < DIMS; d++) {
				row[d] -= mean[d];
			}
		}
		return rows;
	}

	/** 중심 이동된 행들의 공분산 {@code XᵀX / n}. 대칭이라 위 삼각만 계산해 반사한다. */
	private static double[][] covariance(double[][] rows) {
		double[][] cov = new double[DIMS][DIMS];
		for (double[] row : rows) {
			for (int a = 0; a < DIMS; a++) {
				for (int b = a; b < DIMS; b++) {
					cov[a][b] += row[a] * row[b];
				}
			}
		}
		int n = rows.length;
		for (int a = 0; a < DIMS; a++) {
			for (int b = a; b < DIMS; b++) {
				cov[a][b] /= n;
				cov[b][a] = cov[a][b];
			}
		}
		return cov;
	}

	/**
	 * 대칭 행렬을 Jacobi 회전으로 대각화한다.
	 *
	 * @param a 대칭 행렬. <b>제자리에서 파괴된다</b> — 반환 후 대각이 고유값이다
	 * @return 고유벡터 행렬. {@code i}번째 고유벡터는 {@code i}번째 <b>열</b>이다
	 */
	private static double[][] jacobi(double[][] a) {
		int n = a.length;
		double[][] v = new double[n][n];
		for (int i = 0; i < n; i++) {
			v[i][i] = 1;
		}

		for (int sweep = 0; sweep < MAX_SWEEPS; sweep++) {
			double off = 0;
			double total = 0;
			for (int p = 0; p < n; p++) {
				for (int q = 0; q < n; q++) {
					double sq = a[p][q] * a[p][q];
					total += sq;
					if (p != q) {
						off += sq;
					}
				}
			}
			if (off == 0 || off <= OFF_RATIO * total) {
				break;
			}

			for (int p = 0; p < n; p++) {
				for (int q = p + 1; q < n; q++) {
					if (a[p][q] == 0) {
						continue;
					}
					rotate(a, v, p, q);
				}
			}
		}
		return v;
	}

	/** (p, q) 성분을 0 으로 만드는 회전을 a 와 v 에 함께 적용한다. */
	private static void rotate(double[][] a, double[][] v, int p, int q) {
		int n = a.length;
		double apq = a[p][q];
		double theta = (a[q][q] - a[p][p]) / (2 * apq);
		// theta 가 0 이어도 분모가 1 이라 t = ±1 로 잘 정의된다. theta >= 0 을 양수로 고정해 분기를 없앤다.
		double t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
		double cos = 1 / Math.sqrt(t * t + 1);
		double sin = t * cos;

		a[p][p] -= t * apq;
		a[q][q] += t * apq;
		a[p][q] = 0;
		a[q][p] = 0;

		for (int k = 0; k < n; k++) {
			if (k != p && k != q) {
				double akp = a[k][p];
				double akq = a[k][q];
				a[k][p] = cos * akp - sin * akq;
				a[p][k] = a[k][p];
				a[k][q] = sin * akp + cos * akq;
				a[q][k] = a[k][q];
			}
			double vkp = v[k][p];
			double vkq = v[k][q];
			v[k][p] = cos * vkp - sin * vkq;
			v[k][q] = sin * vkp + cos * vkq;
		}
	}

	/** 고유값 내림차순 상위 두 축의 인덱스. 동률이면 인덱스가 낮은 쪽이 앞이다. */
	private static int[] topTwoAxes(double[][] diagonal) {
		int first = 0;
		int second = 1;
		if (diagonal[1][1] > diagonal[0][0]) {
			first = 1;
			second = 0;
		}
		for (int i = 2; i < diagonal.length; i++) {
			double value = diagonal[i][i];
			if (value > diagonal[first][first]) {
				second = first;
				first = i;
			} else if (value > diagonal[second][second]) {
				second = i;
			}
		}
		return new int[] { first, second };
	}

	private static double[] column(double[][] matrix, int index) {
		double[] out = new double[matrix.length];
		for (int k = 0; k < matrix.length; k++) {
			out[k] = matrix[k][index];
		}
		return out;
	}

	/** 부호 규약: 절댓값이 가장 큰 성분(동률이면 낮은 인덱스)을 양수로 만든다. */
	private static double[] signed(double[] axis) {
		int pivot = 0;
		for (int d = 1; d < axis.length; d++) {
			if (Math.abs(axis[d]) > Math.abs(axis[pivot])) {
				pivot = d;
			}
		}
		if (axis[pivot] >= 0) {
			return axis;
		}
		double[] flipped = new double[axis.length];
		for (int d = 0; d < axis.length; d++) {
			flipped[d] = -axis[d];
		}
		return flipped;
	}

	private static double dot(double[] a, double[] b) {
		double sum = 0;
		for (int d = 0; d < a.length; d++) {
			sum += a[d] * b[d];
		}
		return sum;
	}
}
