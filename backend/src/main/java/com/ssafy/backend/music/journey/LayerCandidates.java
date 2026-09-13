package com.ssafy.backend.music.journey;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

import com.ssafy.backend.music.retrieval.SameRecording;
import com.ssafy.backend.music.retrieval.NearestTrackReader;
import com.ssafy.backend.music.retrieval.ServingRules;
import com.ssafy.backend.music.retrieval.TrackCandidate;

import io.micrometer.core.instrument.MeterRegistry;

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
	 * 층당 뽑을 후보 수의 기본값. 후처리가 걸러내므로 필요한 수가 아니라 넉넉한 수다.
	 *
	 * <p><b>2026-09-13 실측으로 200 에서 60 으로 내렸다</b>(S15P21A405-281). 같은 40쌍에
	 * 40·60·80·120·200 을 돌린 결과, 다섯 값 모두 <b>구간 수가 623 으로 같고</b> 평균 구간거리는
	 * 2.903~2.917 로 단조도 아니었다 — 품질 신호가 없다. 반면 층 질의당 비용은
	 * 101.3 → 88.0ms (200 → 60) 로 13% 줄었다. 40 은 86.7ms 로 더 싸지만 584회 중 1회
	 * {@link #MIN_LAYER} 미달 재질의가 발동했고, 60 은 0회였다.
	 *
	 * <p>절감폭이 이 정도에 그치는 이유는 {@code ef_search} 가 200 으로 고정이라(§3.2, S15P21A405-279)
	 * <b>인덱스 훑는 일은 limit 과 무관하게 같기</b> 때문이다. 줄어드는 것은 행 구성과 전송분이다.
	 * 그래서 {@code ef_search} 를 함께 내리지 않는 한 이보다 더 싸지지 않는다.
	 *
	 * <p>실제 값은 {@code ody.journey.layer-limit} 으로 덮어쓴다 — 이 상수는 설정이 없을 때의 기본이다.
	 */
	static final int LAYER_LIMIT = 60;

	/** 이보다 적게 남으면 그 층만 다시 뽑는다 (핸드오프 §4.3-5). */
	static final int MIN_LAYER = 30;

	/**
	 * 재질의 상한. 상한 없는 반복을 두지 않는다 — 원격 호출이 없어 타임아웃이 없다(FR-025).
	 *
	 * <p><b>2026-09-12 측정으로 2 에서 1 로 내렸다.</b> 재질의는 {@code limit} 을 2배씩 올리고
	 * {@code ef_search} 도 따라 오르므로, 3번째 시도(800)가 앞의 둘(200+400)을 합친 것보다 비싸다.
	 * 층 20개 전부에서 상한이 소진되는 최악 케이스가 3887ms 로 종단 3초 예산을 넘었다.
	 *
	 * <p>{@link #LAYER_LIMIT} 개를 훑어 {@link #MIN_LAYER} 를 못 채운 지점은 그 주변에 곡이 실제로 희박한 곳이다.
	 * 4배를 더 훑어도 길이·중복 필터를 통과하는 곡이 비례해 늘 이유가 없다 — 비용은 확실하고
	 * 효용은 불확실한 거래라 접었다. 층이 완전히 비지만 않으면 역은 성립한다(§4.3-5).
	 */
	static final int MAX_RETRY = 1;

	/** 층 질의 횟수. 재질의도 한 번으로 센다 — 재질의율의 분모다. */
	static final String LAYER_QUERY_COUNTER = "ody.journey.layer_query";

	/** {@link #MIN_LAYER} 미달로 다시 뽑은 횟수. 재질의율 = 이 값 / 층 질의 횟수. */
	static final String LAYER_RETRY_COUNTER = "ody.journey.layer_retry";

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
			ServingRules rules, EndpointGuard guard, int n, int layerLimit, MeterRegistry registry) {

		List<List<TrackCandidate>> layers = new ArrayList<>(n);
		for (int k = 1; k <= n; k++) {
			float[] ck = frame.layerPoint(k, n);
			List<TrackCandidate> kept = List.of();

			for (int attempt = 0; attempt <= MAX_RETRY; attempt++) {
				int limit = layerLimit << attempt;
				registry.counter(LAYER_QUERY_COUNTER).increment();
				if (attempt > 0) {
					registry.counter(LAYER_RETRY_COUNTER).increment();
				}
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
