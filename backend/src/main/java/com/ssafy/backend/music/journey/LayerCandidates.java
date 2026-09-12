package com.ssafy.backend.music.journey;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

import com.ssafy.backend.music.retrieval.NearestTrackReader;
import com.ssafy.backend.music.retrieval.ServingRules;
import com.ssafy.backend.music.retrieval.TrackCandidate;

/**
 * 층 후보 선별 (핸드오프 §4.3, T055).
 *
 * <p>층마다 {@code c_k} 최근접을 넉넉히 뽑아 <b>애플리케이션에서</b> 거른다. 조회에 필터를 넣지 않는
 * 이유는 pgvector 0.7.0 이 필터를 걸면 {@code LIMIT} 보다 적게 주기 때문이다(§3.2 함정 2).
 *
 * <p>이 클래스는 저장소를 직접 알지 않는다 — {@code NearestTrackReader} 경계 뒤에 있어서
 * 조회를 mock 으로 두고 합성 좌표만으로 검증된다(FR-019).
 */
final class LayerCandidates {

	/**
	 * 층당 뽑을 후보 수 (핸드오프 §4.8). 참조 구현은 400 이었고 200 이 지연·품질 맞바꿈 지점이다.
	 * 후처리가 걸러내므로 필요한 수가 아니라 넉넉한 수다.
	 */
	static final int LAYER_LIMIT = 200;

	/** 이보다 적게 남으면 그 층만 다시 뽑는다 (핸드오프 §4.3-5). */
	static final int MIN_LAYER = 30;

	/** 재질의 상한. 상한 없는 반복을 두지 않는다 — 원격 호출이 없어 타임아웃이 없다(FR-025). */
	static final int MAX_RETRY = 2;

	private LayerCandidates() {
	}

	/**
	 * 층 1..n 의 후보를 모은다.
	 *
	 * <p>절차(§4.3): {@code c_k} 최근접 → {@code p}·{@code r} 계산 → {@code p<=0}·{@code p>=1} 버림
	 * → A·B 및 그와 같은 녹음 버림 → 길이 규칙 밖 버림 → 부족하면 재질의 → <b>(거리, id) 안정 정렬</b>.
	 *
	 * @return 층별 후보. <b>비어버린 층은 결과에서 빠지므로 크기가 {@code n} 보다 작을 수 있다</b> —
	 *         그 경우 역이 그만큼 줄어든다(§4.3-5)
	 */
	static List<List<TrackCandidate>> collect(NearestTrackReader reader, AxisFrame frame,
			ServingRules rules, EndpointGuard guard, int n) {

		List<List<TrackCandidate>> layers = new ArrayList<>(n);
		for (int k = 1; k <= n; k++) {
			float[] ck = frame.layerPoint(k, n);
			List<TrackCandidate> kept = List.of();

			for (int attempt = 0; attempt <= MAX_RETRY; attempt++) {
				int limit = LAYER_LIMIT << attempt;
				kept = filter(reader.findNearest(ck, limit), frame, rules, guard);
				if (kept.size() >= MIN_LAYER) {
					break;
				}
			}
			// 비어 있지만 않으면 적어도 그 층은 성립한다. 완전히 비면 층을 버려 역이 하나 줄어든다.
			if (!kept.isEmpty()) {
				layers.add(kept);
			}
		}
		return layers;
	}

	/** 조회 결과에 앱 단 규칙을 건다. 순서는 마지막에 (거리, id) 로 고정한다. */
	private static List<TrackCandidate> filter(List<TrackCandidate> raw, AxisFrame frame,
			ServingRules rules, EndpointGuard guard) {

		List<TrackCandidate> kept = new ArrayList<>(raw.size());
		for (TrackCandidate c : raw) {
			double p = frame.progress(c.vec());
			if (p <= 0 || p >= 1) {
				continue;                       // A 뒤 · B 너머
			}
			if (guard.excludes(c, rules.tauDup())) {
				continue;                       // A·B 자신 또는 그와 같은 녹음
			}
			if (!rules.lengthAllowed(c.duration())) {
				continue;
			}
			kept.add(c);
		}
		// 근사 조회라 동률·경계에서 순서가 흔들린다. 안정 정렬이 없으면 같은 두 곡이
		// 호출마다 다른 경로를 낸다(FR-013). 동률 거리에서 순서를 미정의로 남기지 않는다.
		kept.sort(Comparator.comparingDouble(TrackCandidate::dist).thenComparingLong(TrackCandidate::id));
		return kept;
	}

	/**
	 * 출발·도착과 그와 같은 녹음을 후보에서 막는 판정기.
	 *
	 * <p>{@code repairBanned} 는 규칙 위반 복구가 특정 곡을 제외할 때 채워진다(§4.5) —
	 * 재산출마다 후보를 다시 거르므로 여기에 함께 둔다.
	 */
	record EndpointGuard(long startId, long endId, String startKey, String endKey,
			float[] startVec, float[] endVec, Set<Long> repairBanned) {

		boolean excludes(TrackCandidate c, double tauDup) {
			if (c.id() == startId || c.id() == endId || repairBanned.contains(c.id())) {
				return true;
			}
			String key = SameRecording.key(c.title(), c.artist());
			if (SameRecording.sameKey(key, startKey) || SameRecording.sameKey(key, endKey)) {
				return true;
			}
			return c.distanceTo(startVec) < tauDup || c.distanceTo(endVec) < tauDup;
		}
	}
}
