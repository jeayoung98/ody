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

import lombok.extern.slf4j.Slf4j;

/**
 * 주변 탐색 (정본 §3.5, 기능 MAP-10).
 *
 * <p>기준점 해석 → 후보 확보 → 선정 → 상세 채우기 → 조립. 선정 규칙 자체는 {@link NeighborSelection}
 * 이 소유하고 곡 상세(003)와 공유한다 — 같은 곡에 두 진입점이 다른 목록을 주면 안 된다(FR-023, SC-006).
 *
 * <p><b>조회 전용이고 무상태다.</b> 서버에 탐색 세션을 두지 않으므로 이웃을 다시 기준점으로 삼는
 * 연속 탐색이 요청 하나로 완결된다(FR-010).
 */
@Slf4j
@Service
public class NearbyService {

	/** 반환 개수. 서버 고정이고 호출자가 지정하지 않는다(FR-005). */
	static final int NEIGHBOR_COUNT = 10;

	/**
	 * 뽑을 후보 수. <b>필요한 수가 아니라 넉넉한 수</b>다 — 조회에 필터를 넣을 수 없어 여기서 거른다.
	 *
	 * <p><b>조회 어댑터가 {@code hnsw.ef_search} 를 200 으로 고정한다.</b> 색인은 어느 쪽이든 200개를 훑으므로,
	 * {@code LIMIT} 을 그보다 작게 두면 <b>이미 지불한 작업을 버리는 것</b>이다. 그래서 200 에 맞춘다.
	 *
	 * <p><b>2026-09-13 운영 실측.</b> 무작위 5,000곡을 깊이 200 까지 훑어 규칙을 통과한 10곡을 모으는 데
	 * 필요한 후보 순위를 쟀다 — 중앙값 11 · p90 12 · p99 17 · <b>p999 41 · 최악 189</b>. 꼬리가 길다.
	 *
	 * <pre>
	 *   후보   미달률          조회 비용(웜 중앙값, 곡 20개 x 2회)
	 *    20    0.38% (19)      -
	 *    40    0.12%  (6)      3.06 ms
	 *    60    0.04%  (2)      2.97 ms
	 *    80    0.02%  (1)      2.92 ms
	 *   200    0%     (0)      3.18 ms   &lt;- 채택
	 * </pre>
	 *
	 * <p>비용이 평평한 이유가 위의 {@code ef_search} 고정이다. 미달률만 보고 고르면 되고, 200 에서 0 이 된다.
	 *
	 * <p>처음에는 40 이었다 — 깊이 100 에서 끊긴 측정으로 "최악 25" 를 봤기 때문이다. <b>꼬리를 못 본
	 * 측정이었다.</b> 로컬 실행에서 50곡 중 1건이 5곡만 반환한 것(오디오북 지역, 아티스트 상한에 막힘)이
	 * 단서였고, 깊이 200 으로 다시 재자 최악이 189 로 나왔다.
	 *
	 * <p>한동안 이 값이 <b>실제로는 적용되지 않았다</b> — 조회 어댑터가 {@code ef_search} 를 트랜잭션 범위로
	 * 걸어서 다음 질의까지 살아남지 못했고, 200 을 요청해도 매번 40개(색인 기본 탐색폭)만 왔다.
	 * S15P21A405-279 에서 세션 범위로 바꿔 고쳤다. 지금은 요청한 만큼 온다(실측 31회 x 200).
	 *
	 * <p>오류가 나지 않는 종류의 결함이라 {@code ody.nearby.candidate_size} 지표를 넣고서야 드러났다.
	 * <b>그 지표를 지우지 말 것</b> — 같은 일이 다시 생기면 그것만이 알려준다.
	 */
	static final int CANDIDATE_COUNT = 200;

	/** 후보 조회 구간. 콜드(색인이 캐시에서 밀린 뒤)가 어디서 나는지 게이트웨이 구간과 분리해 본다. */
	private static final String CANDIDATE_TIMER = "ody.nearby.candidates";

	/**
	 * 규칙을 통과한 곡이 {@value #NEIGHBOR_COUNT} 곡에 못 미친 요청 수.
	 *
	 * <p><b>후보 수가 충분한지 판단할 유일한 근거다.</b> 2026-09-13 운영 표본 700곡에서 0건이었으므로,
	 * 여기가 0 이 아니면 {@link #CANDIDATE_COUNT} 를 재검토한다(SC-008).
	 */
	private static final String SHORT_RESULT_COUNTER = "ody.nearby.short_result";

	/** 조회가 실제로 돌려준 후보 수. 요청한 {@value #CANDIDATE_COUNT} 보다 적으면 색인 탐색폭이 잘랐다는 뜻이다. */
	private static final String CANDIDATE_SIZE_SUMMARY = "ody.nearby.candidate_size";

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
		log.info("[Nearby] 주변 탐색 완료 id={} neighbors={} lowSimilarity={}",
				id, result.neighbors().size(), result.lowSimilarity());

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
		// 실제로 몇 개를 받았는지. 요청한 수보다 적으면 색인 탐색폭(ef_search) 이 그만큼 잘라낸 것이다 —
		// 오류가 나지 않는 경로라 지표로만 드러난다(핸드오프 §3.2 함정 2).
		meterRegistry.summary(CANDIDATE_SIZE_SUMMARY).record(candidates.size());

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
	 *
	 * <p>{@code findSummariesByIds} 가 아니라 {@code findDetailsByIds} 를 쓴다 — {@code albumMbid} 가
	 * {@code MusicSummary} 에 없어서다(S15P21A405-711). 두 조회는 같은 SQL 이라 비용은 그대로다.
	 */
	private List<NeighborTrack> toNeighbors(List<TrackCandidate> picked) {
		if (picked.isEmpty()) {
			return List.of();
		}
		Map<Long, MusicDetail> byId = new LinkedHashMap<>();
		for (MusicDetail d : detailReader.findDetailsByIds(picked.stream().map(TrackCandidate::id).toList())) {
			byId.put(d.id(), d);
		}
		return picked.stream()
				.map(c -> {
					MusicDetail detail = byId.get(c.id());
					if (detail == null) {
						// 부분 결과를 성공으로 내지 않는다(FR-014).
						throw new IllegalStateException("선정된 곡의 상세를 찾지 못했다: id=" + c.id());
					}
					return new NeighborTrack(toSummary(detail), detail.albumMbid(), c.dist());
				})
				.toList();
	}

	private static MusicSummary toSummary(MusicDetail d) {
		return new MusicSummary(d.id(), d.title(), d.artist(), d.album(), d.youtubeUrl(), d.videoId(), d.location());
	}

	/** 마지막(가장 먼) 이웃이 원거리 임계값을 넘으면 참. <b>이웃이 없으면 참이다.</b> */
	private boolean lowSimilarity(List<TrackCandidate> picked) {
		if (picked.isEmpty()) {
			return true;
		}
		return picked.get(picked.size() - 1).dist() > rules.tauFar();
	}
}
