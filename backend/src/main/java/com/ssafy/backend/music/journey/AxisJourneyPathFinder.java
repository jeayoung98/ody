package com.ssafy.backend.music.journey;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.ssafy.backend.music.retrieval.SameRecording;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.journey.LayerCandidates.EndpointGuard;
import com.ssafy.backend.music.retrieval.NearestTrackReader;
import com.ssafy.backend.music.retrieval.ServingRules;
import com.ssafy.backend.music.retrieval.TrackCandidate;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;

/**
 * 인프로세스 경로 산출 (핸드오프 §4, T056 재산출 루프 + T057 폴백).
 *
 * <p>절차는 층 후보 수집({@link LayerCandidates}) → DP({@link ViterbiPath}) → 규칙 검사 →
 * 위반이면 고쳐서 재실행이다. 방식은 데이터 파트가 정의한 것을 그대로 옮겼고 실행 위치만 백엔드다(FR-017).
 *
 * <p>조회 어댑터가 없으면 {@code Optional} 이 비어 500 이 된다 — 목 좌표를 운영 코드에 두지 않는다(FR-019).
 */
@Slf4j
@Component
public class AxisJourneyPathFinder implements JourneyPathFinder {

	/** 규칙 위반 재시도 상한 (핸드오프 §4.8). 상한이 곧 지연 상한이다 — 타임아웃이 없다(FR-025). */
	static final int MAX_REPAIR = 8;

	/**
	 * 상한을 넘은 아티스트에 더하는 벌점 (핸드오프 §4.8).
	 *
	 * <p>행 단위로 <b>막지 않는</b> 이유가 여기 있다. 곡 하나를 후보에서 빼면 DP 가 같은 아티스트의
	 * 다른 곡을 집어 수렴하지 않는다(참조 구현 실측). 벌점은 유한해서 그 아티스트밖에 없는 통로도 막지 않는다.
	 */
	static final double ARTIST_PENALTY = 1e4;

	/** {@code linear} 폴백은 지점마다 1곡만 고르므로 후보가 적어도 된다 (핸드오프 §4.6). */
	private static final int LINEAR_LIMIT = 20;

	/**
	 * 층 후보 조회 구간 (T064). 핸드오프 §4.8 예상이 층 질의 n회 × 14ms ≈ 140ms 이고 DP 는 수십ms 라
	 * <b>예산이 DB 에 있는지 CPU 에 있는지</b>가 먼저 알아야 할 값이다. 구간을 더 잘게 쪼개는 것은
	 * 이 둘이 실측에서 갈린 뒤에 한다.
	 */
	private static final String CANDIDATE_TIMER = "ody.journey.candidates";

	/** 규칙 재산출 횟수. 상한에 붙으면 지연이 그만큼 늘어난다(FR-025). */
	private static final String REPAIR_COUNTER = "ody.journey.repair";

	private final Optional<NearestTrackReader> reader;
	private final ServingRules rules;
	private final MeterRegistry meterRegistry;

	public AxisJourneyPathFinder(Optional<NearestTrackReader> reader, ServingRules rules,
			MeterRegistry meterRegistry) {
		this.reader = reader;
		this.rules = rules;
		this.meterRegistry = meterRegistry;
	}

	@Override
	public EnginePath find(MusicDetail start, MusicDetail end) {
		NearestTrackReader r = reader.orElseThrow(() -> {
			log.error("music/journey: 층 후보 조회 어댑터 대기 중 (T054)");
			return new CustomException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
		});

		float[] a = start.location().toArray();
		float[] b = end.location().toArray();
		AxisFrame frame = AxisFrame.of(a, b);

		// 서로 다른 곡인데 좌표가 같으면 통로가 성립하지 않는다. 2곡 경로로 끊는다 (FR-012)
		if (frame.degenerate()) {
			return new EnginePath(true, List.of(), List.of(), 0.0, false, "axis", rules.bundle());
		}

		int n = frame.stationCount(rules.farEndpointDist());
		EndpointGuard guard = new EndpointGuard(start.id(), end.id(),
				SameRecording.key(start.title(), start.artist()),
				SameRecording.key(end.title(), end.artist()),
				a, b, new HashSet<>());

		Timer.Sample querySample = Timer.start(meterRegistry);
		List<List<TrackCandidate>> layers;
		try {
			layers = LayerCandidates.collect(r, frame, rules, guard, n);
		} finally {
			querySample.stop(meterRegistry.timer(CANDIDATE_TIMER));
		}
		List<TrackCandidate> path = repair(layers, frame, b);

		String mode = "axis";
		if (path == null) {
			// DP 가 끊겼다. 핸드오프 §4.4 대로 linear 로 폴백한다
			log.warn("journey axis unreachable, falling back to linear: layers={}", layers.size());
			path = linear(r, frame, guard, n);
			mode = "linear";
		}
		if (path == null) {
			return new EnginePath(false, List.of(), List.of(), frame.length(),
					frame.far(rules.farEndpointDist()), mode, rules.bundle());
		}

		List<String> mbids = new ArrayList<>(path.size());
		List<Double> progresses = new ArrayList<>(path.size());
		for (TrackCandidate c : path) {
			mbids.add(c.mbid());
			progresses.add(frame.progress(c.vec()));
		}
		return new EnginePath(true, mbids, progresses, frame.length(),
				frame.far(rules.farEndpointDist()), mode, rules.bundle());
	}

	/**
	 * DP 를 돌리고 규칙 위반이 있으면 고쳐서 다시 푼다 (핸드오프 §4.5).
	 *
	 * <ul>
	 *   <li>같은 녹음이 두 번 → <b>뒤에 나온 그 곡만</b> 후보에서 뺀다</li>
	 *   <li>아티스트 상한 초과 → <b>그 아티스트 전체</b>에 벌점을 더한다</li>
	 * </ul>
	 *
	 * <p>재질의하지 않고 메모리에서 거른다 — 재산출마다 DB 를 다시 때리면 지연 상한이 무너진다.
	 *
	 * @return 규칙을 지킨 경로. DP 가 끊기면 {@code null}
	 * @throws CustomException 상한 안에 규칙을 지킨 경로를 못 얻으면 500 — 위반 경로를 성공으로 내지 않는다
	 */
	private List<TrackCandidate> repair(List<List<TrackCandidate>> layers, AxisFrame frame, float[] endVec) {
		Map<String, Double> penalty = new HashMap<>();
		Set<Long> banned = new HashSet<>();

		for (int attempt = 0; attempt <= MAX_REPAIR; attempt++) {
			List<List<TrackCandidate>> usable = banned.isEmpty() ? layers
					: layers.stream().map(l -> l.stream().filter(c -> !banned.contains(c.id())).toList()).toList();
			if (usable.stream().anyMatch(List::isEmpty)) {
				return null;
			}
			List<TrackCandidate> path = ViterbiPath.solve(usable, frame, endVec, rules.tauDup(), penalty);
			if (path == null) {
				return null;
			}

			Long dup = duplicateRecording(path);
			List<String> over = artistsOverCap(path);
			if (dup == null && over.isEmpty()) {
				return path;
			}
			meterRegistry.counter(REPAIR_COUNTER).increment();
			if (dup != null) {
				banned.add(dup);
			}
			for (String artist : over) {
				penalty.merge(artist, ARTIST_PENALTY, Double::sum);
			}
		}

		log.error("journey repair limit exhausted: attempts={}", MAX_REPAIR);
		throw new CustomException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
	}

	/** 같은 녹음이 두 번 나오면 <b>뒤에 나온</b> 곡 id. 없으면 null. */
	private Long duplicateRecording(List<TrackCandidate> path) {
		Set<String> keys = new HashSet<>();
		Set<Long> ids = new HashSet<>();
		for (TrackCandidate c : path) {
			if (!ids.add(c.id())) {
				return c.id();
			}
			String key = SameRecording.key(c.title(), c.artist());
			if (key != null && !keys.add(key)) {
				return c.id();
			}
		}
		return null;
	}

	/** 상한을 넘은 아티스트 목록. */
	private List<String> artistsOverCap(List<TrackCandidate> path) {
		Map<String, Integer> count = new HashMap<>();
		for (TrackCandidate c : path) {
			if (c.artist() != null) {
				count.merge(c.artist(), 1, Integer::sum);
			}
		}
		return count.entrySet().stream()
				.filter(e -> e.getValue() > rules.artistCap())
				.map(Map.Entry::getKey)
				.sorted()                       // 결정성 — 벌점 적용 순서를 고정한다
				.toList();
	}

	/**
	 * {@code linear} 폴백 (핸드오프 §4.6). 지점마다 아직 쓰지 않은 가장 가까운 곡 하나.
	 *
	 * <p><b>진행도가 역행할 수 있다</b> — 보간 지점마다 독립으로 고르기 때문이고, 이 모드의 알려진
	 * 성질이라 결함이 아니다(같은 40쌍에서 21건). 요청 파라미터로 승격하지 않는다(FR-023).
	 *
	 * <p>패키지 전용인 이유: SC-005(축 대 선형 인접 역 거리 median 비교)를 재려면 검증 경로가
	 * 이 모드를 직접 불러야 한다. 운영 요청 경로에서는 폴백으로만 쓴다(FR-010).
	 */
	List<TrackCandidate> linear(NearestTrackReader r, AxisFrame frame, EndpointGuard guard, int n) {
		List<TrackCandidate> picked = new ArrayList<>(n);
		Set<Long> used = new HashSet<>();
		Set<String> usedKeys = new HashSet<>();

		for (int k = 1; k <= n; k++) {
			float[] ck = frame.layerPoint(k, n);
			for (TrackCandidate c : r.findNearest(ck, LINEAR_LIMIT)) {
				if (used.contains(c.id()) || guard.excludes(c, rules.tauDup())) {
					continue;
				}
				if (!rules.lengthAllowed(c.duration())) {
					continue;
				}
				String key = SameRecording.key(c.title(), c.artist());
				if (key != null && usedKeys.contains(key)) {
					continue;
				}
				picked.add(c);
				used.add(c.id());
				if (key != null) {
					usedKeys.add(key);
				}
				break;
			}
		}
		return picked.isEmpty() ? null : picked;
	}
}
