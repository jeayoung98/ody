package com.ssafy.backend.music.journey;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.retrieval.TrackCandidate;

/**
 * Viterbi DP 단위 테스트 (T056 · T058 · T060). <b>합성 좌표만 쓴다 — 실 DB 불필요.</b>
 *
 * <p>핸드오프 §4.4 의 제약 둘이 실제로 동작하는지가 핵심이다. 둘 다 빠져도 경로는 "나오기" 때문에
 * 테스트가 없으면 조용히 잘못된 경로를 내보낸다.
 */
class ViterbiPathTests {

	private static final double TAU_DUP = 1.6624;

	private static float[] v(double x, double y) {
		float[] a = new float[16];
		a[0] = (float) x;
		a[1] = (float) y;
		return a;
	}

	private static TrackCandidate cand(long id, String artist, double x, double y) {
		return new TrackCandidate(id, "m" + id, "title-" + id, artist, 200, v(x, y), 0.0);
	}

	/** A=(0,0) → B=(20,0) 축. */
	private static AxisFrame frame() {
		return AxisFrame.of(v(0, 0), v(20, 0));
	}

	private static List<TrackCandidate> solve(List<List<TrackCandidate>> layers,
			Map<String, Double> penalty) {
		return ViterbiPath.solve(layers, frame(), v(20, 0), TAU_DUP, penalty);
	}

	// ------------------------------------------------------------ 기본 동작

	@Test
	void solve_picksOnePerLayerInOrder() {
		List<List<TrackCandidate>> layers = List.of(
				List.of(cand(1, "a", 5, 0)),
				List.of(cand(2, "b", 10, 0)),
				List.of(cand(3, "c", 15, 0)));

		List<TrackCandidate> path = solve(layers, Map.of());

		assertThat(path).extracting(TrackCandidate::id).containsExactly(1L, 2L, 3L);
	}

	@Test
	void solve_prefersSmallerOffAxis() {
		// 같은 진행도에서 축에 붙은 쪽이 lambda*r² 만큼 싸다
		List<List<TrackCandidate>> layers = List.of(
				List.of(cand(1, "a", 5, 0), cand(2, "b", 5, 6)),
				List.of(cand(3, "c", 15, 0)));

		List<TrackCandidate> path = solve(layers, Map.of());

		assertThat(path.get(0).id()).isEqualTo(1L);
	}

	// ------------------------------------- T058 진행도 단조 증가 (제약 p(v) > p(u))

	/**
	 * 층 후보가 겹쳐도 진행도가 역행하지 않는다.
	 *
	 * <p>근사 최근접으로 층을 뽑으면 이웃 층 후보 집합이 겹친다. {@code p(v) > p(u)} 가 없으면
	 * 뒤 층에서 앞쪽 곡을 골라 역행한다 — 2026-09-11 예시 생성에서 실제로 나온 현상이다.
	 */
	@Test
	void solve_progressIsMonotonic_evenWhenLayersOverlap() {
		TrackCandidate near = cand(1, "a", 5, 0);
		TrackCandidate mid = cand(2, "b", 10, 0);
		TrackCandidate farOne = cand(3, "c", 15, 0);
		List<TrackCandidate> shared = List.of(near, mid, farOne);
		List<List<TrackCandidate>> layers = List.of(shared, shared, shared);

		List<TrackCandidate> path = solve(layers, Map.of());

		AxisFrame f = frame();
		List<Double> progresses = path.stream().map(c -> f.progress(c.vec())).toList();
		for (int i = 1; i < progresses.size(); i++) {
			assertThat(progresses.get(i)).as("역 %d", i).isGreaterThan(progresses.get(i - 1));
		}
	}

	/**
	 * 뒤로 가는 길밖에 없으면 경로를 만들지 않는다.
	 *
	 * <p><b>이 테스트가 {@code p(v) > p(u)} 제약을 실제로 구속한다.</b> 비용이 제곱이라
	 * 직선 배치에서는 전진이 늘 더 싸서 제약이 걸릴 일이 없다 — 그런 입력으로는 제약을 빼도 통과한다.
	 * 여기서는 1층의 유일한 후보가 2층의 유일한 후보보다 <b>앞서</b> 있어, 제약이 없으면
	 * DP 가 역행 경로를 유한 비용으로 만들어낸다.
	 */
	@Test
	void solve_returnsNullWhenOnlyBackwardPathExists() {
		List<List<TrackCandidate>> layers = List.of(
				List.of(cand(1, "a", 14, 0)),   // 앞쪽
				List.of(cand(2, "b", 6, 0)));   // 뒤쪽 — 역행해야만 닿는다

		assertThat(solve(layers, Map.of())).isNull();
	}

	@Test
	void solve_noDuplicateStation_whenLayersOverlap() {
		List<TrackCandidate> shared = List.of(cand(1, "a", 5, 0), cand(2, "b", 10, 0), cand(3, "c", 15, 0));
		List<List<TrackCandidate>> layers = List.of(shared, shared, shared);

		List<TrackCandidate> path = solve(layers, Map.of());

		assertThat(path).extracting(TrackCandidate::id).doesNotHaveDuplicates();
	}

	// --------------------------------------- 제자리걸음 차단 (제약 step >= tau_dup)

	/**
	 * 제자리걸음이 <b>더 싼데도</b> 고르지 않는다.
	 *
	 * <p>{@code step >= tau_dup} 제약을 구속하려면 가까운 후보가 실제로 저비용이어야 한다.
	 * 먼 대안을 축에서 띄워 {@code lambda*r²} 를 물리면 그 조건이 만들어진다 —
	 * 대안이 축 위에 있으면 전진이 그냥 더 싸서 제약을 빼도 통과한다.
	 */
	@Test
	void solve_rejectsTransitionsShorterThanTauDup() {
		List<List<TrackCandidate>> layers = List.of(
				List.of(cand(1, "a", 10, 0)),
				// 2번은 1번 바로 옆(0.5)이라 싸다. 3번은 멀고 축에서 4 만큼 떠 있어 비싸다.
				List.of(cand(2, "b", 10.5, 0), cand(3, "c", 15, 4)));

		List<TrackCandidate> path = solve(layers, Map.of());

		assertThat(path).extracting(TrackCandidate::id).containsExactly(1L, 3L);
	}

	@Test
	void solve_returnsNullWhenEveryTransitionIsBlocked() {
		// 유일한 후보가 A 바로 옆이라 첫 전이부터 막힌다
		List<List<TrackCandidate>> layers = List.of(List.of(cand(1, "a", 0.5, 0)));

		assertThat(solve(layers, Map.of())).isNull();
	}

	@Test
	void solve_returnsEmptyWhenNoLayers() {
		// 층이 전부 비어 떨어져 나간 경우 — 출발·도착 2곡 경로가 된다(FR-012)
		assertThat(solve(List.of(), Map.of())).isEmpty();
	}

	// ------------------------------------------------- 아티스트 벌점 (§4.5 연동)

	@Test
	void solve_avoidsPenalizedArtist_whenAlternativeExists() {
		Map<String, Double> penalty = new HashMap<>();
		penalty.put("heavy", 1e4);
		List<List<TrackCandidate>> layers = List.of(
				List.of(cand(1, "heavy", 10, 0), cand(2, "light", 10, 3)));

		List<TrackCandidate> path = solve(layers, penalty);

		assertThat(path.get(0).id()).isEqualTo(2L);
	}

	/**
	 * 벌점은 유한하다 — 그 아티스트밖에 없는 통로도 막히지 않는다.
	 *
	 * <p>행 단위로 <b>막으면</b> 통로가 끊기지만 벌점은 비싸기만 하다. 이것이 §4.5 가
	 * 아티스트 제외 대신 벌점을 쓰는 이유다.
	 */
	@Test
	void solve_stillFindsPathWhenOnlyPenalizedArtistExists() {
		Map<String, Double> penalty = new HashMap<>();
		penalty.put("only", 1e4);
		List<List<TrackCandidate>> layers = List.of(List.of(cand(1, "only", 10, 0)));

		List<TrackCandidate> path = solve(layers, penalty);

		assertThat(path).extracting(TrackCandidate::id).containsExactly(1L);
	}

	// ------------------------------------------------------- T060 결정성

	/**
	 * 같은 입력이면 같은 경로가 나온다 — 동률 비용 후보를 포함해서.
	 *
	 * <p>후보 순서가 흔들리면 동률에서 다른 곡이 뽑힌다. 정렬 고정(T055)과 DP 의 결정적 tie-break 가
	 * 함께 지켜야 하는 성질이다(FR-013).
	 */
	@Test
	void solve_isDeterministic_withTiedCosts() {
		// 축 대칭이라 비용이 정확히 같은 두 후보
		List<List<TrackCandidate>> layers = List.of(
				List.of(cand(1, "a", 10, 4), cand(2, "b", 10, -4)));

		List<TrackCandidate> first = solve(layers, Map.of());
		for (int i = 0; i < 20; i++) {
			assertThat(solve(layers, Map.of())).extracting(TrackCandidate::id)
					.containsExactlyElementsOf(first.stream().map(TrackCandidate::id).toList());
		}
	}

	@Test
	void solve_handlesTenLayersOfTwoHundred() {
		// 실제 규모: 층 10 × 후보 200. 지연이 아니라 터지지 않는지만 본다
		List<List<TrackCandidate>> layers = new ArrayList<>();
		long id = 1;
		for (int k = 1; k <= 10; k++) {
			List<TrackCandidate> layer = new ArrayList<>(200);
			double x = 20.0 * k / 11;
			for (int i = 0; i < 200; i++) {
				layer.add(cand(id++, "artist" + (i % 7), x, (i - 100) * 0.05));
			}
			layers.add(layer);
		}

		List<TrackCandidate> path = solve(layers, Map.of());

		assertThat(path).hasSize(10);
		assertThat(path).extracting(TrackCandidate::id).doesNotHaveDuplicates();
	}
}
