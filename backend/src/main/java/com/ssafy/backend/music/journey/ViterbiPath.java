package com.ssafy.backend.music.journey;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import com.ssafy.backend.music.retrieval.TrackCandidate;

/**
 * 층을 지나는 최소비용 경로 (핸드오프 §4.4, T056).
 *
 * <pre>
 * cost[k][v] = min over u in 층(k-1) of  cost[k-1][u] + step(u,v)²
 *              단 step(u,v) &gt;= tau_dup  이고  p(v) &gt; p(u)  인 u 만
 *            + lambda * r(v)²                      lambda = 2.0
 * </pre>
 *
 * <p>시작은 A({@code p=0}), 끝은 B({@code p=1})다. 마지막에 B 로 한 번 더 전이하고 역추적한다.
 *
 * <h2>제약 둘을 빼면 안 된다</h2>
 * <ul>
 *   <li><b>{@code step >= tau_dup}</b> — 막지 않으면 같은 녹음의 다른 제출본으로 제자리걸음하는
 *       경로가 나온다.</li>
 *   <li><b>{@code p(v) > p(u)}</b> — 층 후보를 근사 최근접으로 뽑으면 <b>이웃 층의 후보 집합이 겹친다</b>
 *       (참조 구현은 진행도 구간으로 잘라서 안 겹쳤다). 제약 없이 돌리면 같은 곡이 두 역에 나오고
 *       진행도가 역행한다 — 2026-09-11 예시 생성에서 실제로 나왔다. 이 제약 하나로 둘 다 사라진다.</li>
 * </ul>
 *
 * <p>저장소를 모른다 — 후보 목록과 축만 받는다. 합성 좌표로 검증된다(FR-019).
 */
final class ViterbiPath {

	/** 축 이탈 벌점 가중치 (핸드오프 §4.8). λ=0.5·1·2 가 같은 경로였다(실측). */
	static final double LAMBDA_OFF_AXIS = 2.0;

	private static final double INF = Double.POSITIVE_INFINITY;

	private ViterbiPath() {
	}

	/**
	 * 최소비용 열을 고른다.
	 *
	 * @param layers        층별 후보. 각 층은 비어 있지 않아야 한다
	 * @param frame         A→B 축
	 * @param endVec        도착곡 좌표. 마지막 전이 대상
	 * @param tauDup        이보다 짧은 전이는 쓰지 않는다
	 * @param artistPenalty 아티스트별 누적 벌점(§4.5). 없으면 빈 map
	 * @return 중간 정거장 열(출발·도착 제외). 유한한 비용이 없으면 {@code null}
	 */
	static List<TrackCandidate> solve(List<List<TrackCandidate>> layers, AxisFrame frame,
			float[] endVec, double tauDup, Map<String, Double> artistPenalty) {

		if (layers.isEmpty()) {
			return List.of();
		}

		// 0층은 출발곡 하나. p(A) = 0 이므로 모든 후보가 p(v) > p(u) 를 만족한다.
		double[] prevCost = { 0.0 };
		List<TrackCandidate> prevLayer = null;
		List<int[]> back = new ArrayList<>(layers.size() + 1);

		for (List<TrackCandidate> layer : layers) {
			double[] cost = new double[layer.size()];
			int[] from = new int[layer.size()];

			for (int vi = 0; vi < layer.size(); vi++) {
				TrackCandidate v = layer.get(vi);
				double best = INF;
				int bestU = -1;

				for (int ui = 0; ui < prevCost.length; ui++) {
					if (prevCost[ui] == INF) {
						continue;
					}
					double step = (prevLayer == null)
							? v.distanceTo(frame.layerStart())
							: v.distanceTo(prevLayer.get(ui).vec());
					if (step < tauDup) {
						continue;                                   // 제자리걸음 차단
					}
					double pu = (prevLayer == null) ? 0.0 : frame.progress(prevLayer.get(ui).vec());
					if (frame.progress(v.vec()) <= pu) {
						continue;                                   // 진행도 역행·역 중복 차단
					}
					double candidate = prevCost[ui] + step * step;
					if (candidate < best) {
						best = candidate;
						bestU = ui;
					}
				}

				double r = frame.offAxis(v.vec());
				cost[vi] = (best == INF) ? INF
						: best + LAMBDA_OFF_AXIS * r * r + penaltyOf(v, artistPenalty);
				from[vi] = bestU;
			}

			if (allInfinite(cost)) {
				return null;                                        // 이 층에서 끊겼다
			}
			back.add(from);
			prevCost = cost;
			prevLayer = layer;
		}

		// 마지막으로 B 로 한 번 더 전이한다. p(B) = 1 이라 모든 후보가 p(v) > p(u) 를 만족한다.
		double best = INF;
		int bestU = -1;
		for (int ui = 0; ui < prevCost.length; ui++) {
			if (prevCost[ui] == INF) {
				continue;
			}
			double step = prevLayer.get(ui).distanceTo(endVec);
			if (step < tauDup) {
				continue;
			}
			double candidate = prevCost[ui] + step * step;
			if (candidate < best) {
				best = candidate;
				bestU = ui;
			}
		}
		if (bestU < 0) {
			return null;
		}

		List<TrackCandidate> path = new ArrayList<>(layers.size());
		int idx = bestU;
		for (int k = layers.size() - 1; k >= 0; k--) {
			path.add(layers.get(k).get(idx));
			idx = back.get(k)[idx];
		}
		Collections.reverse(path);
		return path;
	}

	private static double penaltyOf(TrackCandidate v, Map<String, Double> artistPenalty) {
		if (artistPenalty.isEmpty() || v.artist() == null) {
			return 0.0;
		}
		return artistPenalty.getOrDefault(v.artist(), 0.0);
	}

	private static boolean allInfinite(double[] cost) {
		for (double c : cost) {
			if (c != INF) {
				return false;
			}
		}
		return true;
	}
}
