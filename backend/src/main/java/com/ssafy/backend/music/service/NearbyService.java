package com.ssafy.backend.music.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.NearbyCenter;
import com.ssafy.backend.music.dto.NearbyResponse;
import com.ssafy.backend.music.dto.NeighborTrack;
import com.ssafy.backend.music.retrieval.NearestTrackReader;
import com.ssafy.backend.music.retrieval.NeighborSelection;
import com.ssafy.backend.music.retrieval.ServingRules;
import com.ssafy.backend.music.retrieval.TrackCandidate;

/**
 * 주변 탐색 (정본 §3.5, 기능 MAP-10).
 *
 * <p>기준점 해석 → 후보 확보 → 선정 → 상세 채우기 → 조립. 선정 규칙 자체는 {@link NeighborSelection}
 * 이 소유하고 곡 상세(003)와 공유한다 — 같은 곡에 두 진입점이 다른 목록을 주면 안 된다(FR-023, SC-006).
 *
 * <p><b>조회 전용이고 무상태다.</b> 서버에 탐색 세션을 두지 않으므로 이웃을 다시 기준점으로 삼는
 * 연속 탐색이 요청 하나로 완결된다(FR-010).
 */
@Service
public class NearbyService {

	/** 반환 개수. 서버 고정이고 호출자가 지정하지 않는다(FR-005). */
	static final int NEIGHBOR_COUNT = 10;

	/**
	 * 뽑을 후보 수. <b>필요한 수가 아니라 넉넉한 수</b>다 — 조회에 필터를 넣을 수 없어 여기서 거른다.
	 *
	 * <p><b>2026-09-13 운영 실측으로 정했다.</b> 무작위 700곡에서 규칙을 통과한 10곡을 모으는 데 필요한
	 * 후보는 중앙값 11 · 상위 1% 16 · <b>최악 25</b> 였고 30위를 넘긴 곡은 0건이었다. 40 은 최악의 1.6배
	 * 여유이고, HNSW {@code ef_search} 기본값이 정확히 40 이라 <b>설정 상향이 불필요해진다</b> —
	 * 100 을 쓰면 웜 1.2ms 가 4.0ms 로, 콜드는 350ms 가 된다.
	 */
	static final int CANDIDATE_COUNT = 40;

	/** 후보 조회 구간. 콜드(색인이 캐시에서 밀린 뒤)가 어디서 나는지 게이트웨이 구간과 분리해 본다. */
	private static final String CANDIDATE_TIMER = "ody.nearby.candidates";

	/**
	 * 규칙을 통과한 곡이 {@value #NEIGHBOR_COUNT} 곡에 못 미친 요청 수.
	 *
	 * <p><b>후보 수가 충분한지 판단할 유일한 근거다.</b> 2026-09-13 운영 표본 700곡에서 0건이었으므로,
	 * 여기가 0 이 아니면 {@link #CANDIDATE_COUNT} 를 재검토한다(SC-008).
	 */
	private static final String SHORT_RESULT_COUNTER = "ody.nearby.short_result";

	private final Optional<NearestTrackReader> nearestReader;
	private final MusicDetailReader detailReader;
	private final ServingRules rules;
	private final MeterRegistry meterRegistry;

	public NearbyService(Optional<NearestTrackReader> nearestReader,
			MusicDetailReader detailReader, ServingRules rules, MeterRegistry meterRegistry) {
		this.nearestReader = nearestReader;
		this.detailReader = detailReader;
		this.rules = rules;
		this.meterRegistry = meterRegistry;
	}

	/**
	 * 곡을 기준점으로 주변 곡을 찾는다.
	 *
	 * @param id 기준 곡 id
	 * @return 기준점 + 이웃 최대 {@value #NEIGHBOR_COUNT} 곡 + 유사도 낮음 표시
	 * @throws CustomException 없는 곡이면 {@code MUSIC_NOT_FOUND}(404)
	 */
	public NearbyResponse findNearby(long id) {
		MusicDetail center = detailReader.findDetail(id)
				.orElseThrow(() -> new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));

		NeighborResult result = neighborsOf(center);

		return new NearbyResponse(
				NearbyCenter.ofTrack(center.id(), center.title(), center.artist(), center.location()),
				result.neighbors(),
				result.lowSimilarity());
	}

	/**
	 * 기준 곡의 이웃을 산출한다. <b>주변 탐색과 곡 상세(003)가 이 메서드 하나를 공유한다</b> —
	 * 규칙이 두 벌이 되면 같은 곡에 두 화면이 다른 목록을 준다(FR-023, SC-006).
	 *
	 * <p>기준 곡 상세를 이미 읽은 호출자가 그것을 넘긴다 — 같은 조회를 두 번 하지 않기 위해서다.
	 */
	public NeighborResult neighborsOf(MusicDetail center) {
		NearestTrackReader reader = nearestReader.orElseThrow(
				() -> new UnsupportedOperationException("music/nearby: 좌표 최근접 어댑터 대기 중"));

		// 좌표를 값으로 넘긴다. 조회 안에서 계산하게 하면 근사 색인이 그 값을 쓰지 못해 조용히 틀린다.
		Timer.Sample sample = Timer.start(meterRegistry);
		List<TrackCandidate> candidates = reader.findNearest(center.location().toArray(), CANDIDATE_COUNT);
		sample.stop(meterRegistry.timer(CANDIDATE_TIMER));

		TrackCandidate queryTrack = new TrackCandidate(
				center.id(), center.mbid(), center.title(), center.artist(),
				center.duration(), center.location().toArray(), 0.0);

		List<TrackCandidate> picked =
				NeighborSelection.select(candidates, queryTrack, rules, NEIGHBOR_COUNT);

		if (picked.size() < NEIGHBOR_COUNT) {
			meterRegistry.counter(SHORT_RESULT_COUNTER).increment();
		}
		return new NeighborResult(toNeighbors(picked), lowSimilarity(picked));
	}

	/** 이웃 목록과 유사도 낮음 표시. 두 진입점이 같은 값을 쓴다. */
	public record NeighborResult(List<NeighborTrack> neighbors, boolean lowSimilarity) {
	}

	/**
	 * 확정된 곡에만 상세 필드를 채운다. 후보 전체에 조인하지 않는다 — 그 비용이 그대로 지연이 된다.
	 *
	 * <p>조회는 순서를 보장하지 않으므로 <b>선정 순서로 재조립</b>한다. 조회 결과 순서에 기대면
	 * 정렬 보장(FR-008)이 조용히 깨진다.
	 */
	private List<NeighborTrack> toNeighbors(List<TrackCandidate> picked) {
		if (picked.isEmpty()) {
			return List.of();
		}
		Map<Long, MusicSummary> byId = new LinkedHashMap<>();
		for (MusicSummary s : detailReader.findSummariesByMbids(picked.stream().map(TrackCandidate::mbid).toList())) {
			byId.put(s.id(), s);
		}
		return picked.stream()
				.map(c -> {
					MusicSummary summary = byId.get(c.id());
					if (summary == null) {
						// 부분 결과를 성공으로 내지 않는다(FR-014).
						throw new IllegalStateException("선정된 곡의 상세를 찾지 못했다: id=" + c.id());
					}
					return new NeighborTrack(summary, c.dist());
				})
				.toList();
	}

	/** 마지막(가장 먼) 이웃이 원거리 임계값을 넘으면 참. <b>이웃이 없으면 참이다.</b> */
	private boolean lowSimilarity(List<TrackCandidate> picked) {
		if (picked.isEmpty()) {
			return true;
		}
		return picked.get(picked.size() - 1).dist() > rules.tauFar();
	}
}
