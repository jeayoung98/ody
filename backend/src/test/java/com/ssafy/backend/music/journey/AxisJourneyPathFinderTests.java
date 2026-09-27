package com.ssafy.backend.music.journey;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.Set;

import org.junit.jupiter.api.Test;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

import com.ssafy.backend.music.retrieval.SameRecording;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.retrieval.NearestTrackReader;
import com.ssafy.backend.music.retrieval.ServingRules;
import com.ssafy.backend.music.retrieval.TrackCandidate;

/**
 * 인프로세스 산출 오케스트레이션 테스트 (T056 재산출 루프 · T057 폴백 · T059 규칙 수렴).
 *
 * <p><b>조회를 mock 으로 두고 합성 좌표만 쓴다 — 실 DB 불필요.</b> 이것이 산출을
 * {@code NearestTrackReader} 경계 뒤에 둔 이유다(FR-019).
 */
class AxisJourneyPathFinderTests {

	private static final ServingRules RULES =
			new ServingRules("v2.1-pca16", 1.6624, 3, 4.912, 30, 1200, 10.7);

	// ------------------------------------------------------------------ helpers

	private static Location loc(double x, double y) {
		return new Location(x, y, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
	}

	private static MusicDetail song(long id, String title, String artist, double x, double y) {
		return new MusicDetail(id, "m" + id, title, artist, 120.0, 200, "album", "alb-m" + id, 1999,
				"https://youtu.be/" + id, null, loc(x, y), 1, 0);
	}

	private static TrackCandidate cand(long id, String title, String artist, double x, double y) {
		float[] v = new float[16];
		v[0] = (float) x;
		v[1] = (float) y;
		return new TrackCandidate(id, "m" + id, title, artist, 200, v, 0.0);
	}

	/** 넘긴 후보 풀을 거리순으로 돌려주는 조회 mock. 층마다 같은 풀을 준다(근사 조회의 겹침 재현). */
	private static NearestTrackReader readerOf(List<TrackCandidate> pool) {
		return (point, limit) -> {
			List<TrackCandidate> sorted = new ArrayList<>(pool);
			sorted.sort((l, r) -> Double.compare(l.distanceTo(point), r.distanceTo(point)));
			return sorted.subList(0, Math.min(limit, sorted.size())).stream()
					.map(c -> new TrackCandidate(c.id(), c.mbid(), c.title(), c.artist(),
							c.duration(), c.vec(), c.distanceTo(point)))
					.toList();
		};
	}

	private static AxisJourneyPathFinder finderOf(List<TrackCandidate> pool) {
		return new AxisJourneyPathFinder(Optional.of(readerOf(pool)), RULES, new SimpleMeterRegistry(), LayerCandidates.LAYER_LIMIT, 2.5);
	}

	/** A=(0,0) → B=(60,0). L=60 이라 상한 18역에 붙는다(007). */
	private static MusicDetail start() {
		return song(1, "start", "sa", 0, 0);
	}

	private static MusicDetail end() {
		return song(2, "end", "eb", 60, 0);
	}

	/** 축을 따라 고르게 깔린 후보 풀. */
	private static List<TrackCandidate> spread(int count, String artistPrefix) {
		List<TrackCandidate> pool = new ArrayList<>(count);
		for (int i = 0; i < count; i++) {
			double x = 2.0 + i * (56.0 / count);
			pool.add(cand(100 + i, "t" + i, artistPrefix + (i % 11), x, (i % 5) - 2));
		}
		return pool;
	}

	// -------------------------------------------------------- T059 규칙 수렴

	/**
	 * 한 아티스트가 후보를 뒤덮어도 상한을 지킨 경로로 수렴한다.
	 *
	 * <p>절반이 같은 아티스트인 구역을 만든다. 벌점이 없으면 DP 가 축에 가까운 그 아티스트 곡들을
	 * 계속 골라 상한을 넘는다.
	 */
	@Test
	void repair_convergesToArtistCap_whenOneArtistDominates() {
		List<TrackCandidate> pool = new ArrayList<>();
		// 축 위(r=0)에 몰린 'heavy' — 벌점이 없으면 DP 가 이쪽만 고른다
		for (int i = 0; i < 40; i++) {
			pool.add(cand(200 + i, "h" + i, "heavy", 2.0 + i * 1.4, 0));
		}
		// 축에서 조금 떨어진 대안들
		for (int i = 0; i < 40; i++) {
			pool.add(cand(300 + i, "o" + i, "other" + (i % 9), 2.0 + i * 1.4, 1.5));
		}

		EnginePath path = finderOf(pool).find(start(), end());

		assertThat(path.reachable()).isTrue();
		Map<String, Integer> byArtist = countArtists(pool, path);
		assertThat(byArtist.getOrDefault("heavy", 0))
				.as("아티스트 상한 %d 를 지켜야 한다", RULES.artistCap())
				.isLessThanOrEqualTo(RULES.artistCap());
	}

	@Test
	void repair_leavesNoDuplicateRecording() {
		// 같은 (title, artist) 키를 가진 곡을 여러 좌표에 흩뿌린다
		List<TrackCandidate> pool = new ArrayList<>(spread(60, "art"));
		for (int i = 0; i < 10; i++) {
			pool.add(cand(500 + i, "same-title", "same-artist", 5.0 + i * 5, 0.2));
		}

		EnginePath path = finderOf(pool).find(start(), end());

		assertThat(path.reachable()).isTrue();
		List<String> keys = new ArrayList<>();
		for (Long id : path.stationIds()) {
			TrackCandidate c = byId(pool, id);
			String k = SameRecording.key(c.title(), c.artist());
			if (k != null) {
				keys.add(k);
			}
		}
		assertThat(keys).doesNotHaveDuplicates();
	}

	/**
	 * 벌점 방식을 택한 이유 — <b>행 단위 차단은 수렴하지 않는다.</b>
	 *
	 * <p>같은 아티스트만 있는 풀에서 곡 하나씩 빼는 방식이면 DP 가 그 아티스트의 다른 곡을 계속 집어
	 * 상한 안에 끝나지 않는다. 벌점은 유한해서 <b>그 아티스트밖에 없는 통로도 막지 않으므로</b>
	 * 경로 자체는 나온다 — 상한을 못 지킬 뿐이고, 그 경우 위반 경로를 성공으로 내지 않고 500 이다.
	 */
	@Test
	void repair_throwsRatherThanReturningRuleViolatingPath() {
		// 통로에 오직 한 아티스트뿐이라 상한(3)을 지킬 방법이 없다
		List<TrackCandidate> pool = new ArrayList<>();
		for (int i = 0; i < 40; i++) {
			pool.add(cand(700 + i, "only" + i, "onlyArtist", 2.0 + i * 1.4, 0));
		}

		assertThatThrownBy(() -> finderOf(pool).find(start(), end()))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode().getCode())
				.isEqualTo("INTERNAL_SERVER_ERROR");
	}

	// ------------------------------------------------------ 조회 어댑터 부재

	@Test
	void find_throwsWhenReaderAbsent() {
		AxisJourneyPathFinder finder =
				new AxisJourneyPathFinder(Optional.empty(), RULES, new SimpleMeterRegistry(), LayerCandidates.LAYER_LIMIT, 2.5);

		assertThatThrownBy(() -> finder.find(start(), end()))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode().getCode())
				.isEqualTo("INTERNAL_SERVER_ERROR");
	}

	// ---------------------------------------------------------- 경계 · 메타

	@Test
	void find_returnsTwoSongPathWhenCoordinatesIdentical() {
		// 서로 다른 곡인데 좌표가 같다 — 축이 성립하지 않는다 (FR-012)
		EnginePath path = finderOf(spread(30, "a")).find(song(1, "s", "sa", 5, 5), song(2, "e", "eb", 5, 5));

		assertThat(path.reachable()).isTrue();
		assertThat(path.stationIds()).isEmpty();
		assertThat(path.endpointDist()).isZero();
	}

	@Test
	void find_marksFarAndGrowsStations() {
		// L = 60 > 10.7 이라 far, 역 수는 상한 20
		EnginePath path = finderOf(spread(80, "a")).find(start(), end());

		assertThat(path.far()).isTrue();
		assertThat(path.stationIds()).hasSizeLessThanOrEqualTo(20);
		assertThat(path.bundle()).isEqualTo("v2.1-pca16");
	}

	@Test
	void find_progressIsMonotonicInAxisMode() {
		EnginePath path = finderOf(spread(80, "a")).find(start(), end());

		assertThat(path.mode()).isEqualTo("axis");
		assertThat(path.progressMonotonic())
				.as("axis 에서 역행이 나오면 데이터가 아니라 산출 구현의 결함이다 (FR-020)")
				.isTrue();
	}

	// -------------------------------------------------------- T057 linear 폴백

	@Test
	void find_fallsBackToLinearWhenAxisCannotConnect() {
		// 가운데 한 점에 뭉친 후보들. A·B 와는 충분히 멀어 후보로 살아남지만(같은 녹음 아님),
		// 서로는 tau_dup 안에 붙어 있어 층 간 전이가 전부 막힌다 -> DP 가 끊긴다.
		List<TrackCandidate> pool = new ArrayList<>();
		for (int i = 0; i < 30; i++) {
			pool.add(cand(900 + i, "n" + i, "art" + i, 28.0 + i * 0.03, (i % 7) * 0.05));
		}

		EnginePath path = finderOf(pool).find(start(), end());

		assertThat(path.mode()).isEqualTo("linear");
		assertThat(path.reachable()).isTrue();
	}

	/**
	 * 후보가 전부 걸러지면 중간 정거장 없이 2곡 경로가 된다.
	 *
	 * <p>A 바로 옆에 뭉친 곡들은 "A 와 같은 녹음"(거리 &lt; tau_dup)이라 후보에서 빠진다.
	 * 층이 전부 비면 역이 없어지는데, 이것은 실패가 아니라 정의된 동작이다(FR-009·FR-012).
	 */
	@Test
	void find_returnsTwoSongPathWhenEveryCandidateIsFilteredOut() {
		List<TrackCandidate> pool = new ArrayList<>();
		for (int i = 0; i < 30; i++) {
			pool.add(cand(950 + i, "n" + i, "art" + i, 0.3 + i * 0.01, 0));
		}

		EnginePath path = finderOf(pool).find(start(), end());

		assertThat(path.reachable()).isTrue();
		assertThat(path.stationIds()).isEmpty();
	}

	// ------------------------------------------------------------------ 보조

	private static TrackCandidate byId(List<TrackCandidate> pool, long id) {
		return pool.stream().filter(c -> c.id() == id).findFirst().orElseThrow();
	}

	private static Map<String, Integer> countArtists(List<TrackCandidate> pool, EnginePath path) {
		Map<String, Integer> count = new HashMap<>();
		Set<Long> seen = new HashSet<>(path.stationIds());
		for (TrackCandidate c : pool) {
			if (seen.contains(c.id())) {
				count.merge(c.artist(), 1, Integer::sum);
			}
		}
		return count;
	}

	// ------------------------------- 끝점이 가까운 쌍 (007, S15P21A405-286)
	// 역 수 하한이 10 에서 0 으로 바뀌면서 처음 실행되는 경로다. 코드상으로는 이미
	// 안전했지만(ViterbiPath.solve 가 빈 층에서 List.of() 를 준다) 한 번도 돌아본 적이
	// 없어 여기서 고정한다.

	@Test
	void closePair_yieldsReachablePathWithNoStations() {
		// L = 2.0 < spacing 2.5 -> 중간에 넣을 자리가 없다
		AxisJourneyPathFinder finder = finderOf(spread(40, "a"));
		EnginePath path = finder.find(song(1, "start", "sa", 0, 0), song(2, "end", "eb", 2, 0));

		assertThat(path.reachable()).isTrue();          // 422 가 아니다
		assertThat(path.stationIds()).isEmpty();      // 출발·도착만 남는다
		assertThat(path.progresses()).isEmpty();
		assertThat(path.mode()).isEqualTo("axis");      // linear 폴백으로 새지 않는다
	}

	@Test
	void closePair_doesNotQueryLayers() {
		// 역이 0개면 층 질의도 0회여야 한다. 헛도는 조회가 남아 있으면 여기서 잡힌다.
		AtomicInteger calls = new AtomicInteger();
		NearestTrackReader counting = (point, limit) -> {
			calls.incrementAndGet();
			return List.of();
		};
		AxisJourneyPathFinder finder = new AxisJourneyPathFinder(Optional.of(counting), RULES,
				new SimpleMeterRegistry(), LayerCandidates.LAYER_LIMIT, 2.5);

		EnginePath path = finder.find(song(1, "start", "sa", 0, 0), song(2, "end", "eb", 2, 0));

		assertThat(calls).hasValue(0);
		assertThat(path.reachable()).isTrue();
	}
}
