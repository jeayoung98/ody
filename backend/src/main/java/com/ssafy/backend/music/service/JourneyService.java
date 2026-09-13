package com.ssafy.backend.music.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.JourneyResponse;
import com.ssafy.backend.music.dto.JourneyStop;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.journey.EnginePath;
import com.ssafy.backend.music.journey.JourneyPathFinder;
import com.ssafy.backend.music.journey.JourneyTrackReader;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;

/**
 * 경로 탐색 게이트웨이 (정본 §3.3, 기능 ID JOURNEY-01).
 *
 * <p><b>경로 산출은 여기서 하지 않는다.</b> {@code JourneyPathFinder} 경계 뒤에서 이뤄지고(rev.3 인프로세스,
 * FR-017) 이 서비스는 식별자 해석 · 산출 호출 · 상세 조립 · 정본 계약 준수 · 오류 매핑을 담당한다.
 *
 * <p>흐름은 <b>DB 조회 2회 + 산출 1회</b>다(research R3). 출발·도착 상세를 먼저 읽어 좌표·mbid 를 얻고
 * (없는 곡 404 도 여기서 걸린다), 산출이 준 중간 정거장 mbid 를 한 번에 조회해 양 끝을 붙인다.
 *
 * <p>MusicService 와 합치지 않고 따로 둔다 — MusicService 는 이미 검색·상세·대표곡을 갖고 있고
 * 여정은 의존하는 port 가 다르다.
 */
@Slf4j
@Service
public class JourneyService {

	/**
	 * 정본 §3.3 계약 상한. <b>산출 정거장 상한이 18 이라 실제로는 최대 20곡이다</b>(007, S15P21A405-286).
	 *
	 * <p>구조적으로 도달할 수 없는 방어선이다. 그래도 남겨 두는 이유는 여기 걸리면 데이터가 아니라
	 * <b>산출이 자기 상한을 어긴 것</b>이기 때문이다 — 그때는 잘라내지 않고 실패시킨다(FR-005).
	 */
	private static final int MAX_PATH_SIZE = 30;

	/**
	 * 산출 구간 전체 (T064). rev.2 에서는 원격 홉을 재던 이름인데 rev.3 에서 <b>인프로세스 산출</b>을
	 * 재는 뜻으로 바뀌었다. <b>이름은 유지한다</b> — 대시보드·히스토그램 설정이 이 이름을 참조한다.
	 * 내부 분해(층 조회 vs DP)는 {@code ody.journey.candidates} 가 맡는다.
	 */
	private static final String ENGINE_TIMER = "ody.journey.engine";
	private static final String MONOTONIC_VIOLATION_COUNTER = "ody.journey.progress.not_monotonic";

	private final Optional<MusicDetailReader> detailReader;
	private final Optional<JourneyPathFinder> pathFinder;
	private final Optional<JourneyTrackReader> trackReader;
	private final MeterRegistry meterRegistry;

	// 세 port 모두 어댑터가 붙었다(2026-09-12). Optional 은 유지한다 — 슬라이스 테스트가 일부만
	// 올리고, 어댑터가 빠졌을 때 기동 실패 대신 500 + 진단 로그로 내리는 편이 원인을 빨리 찾게 한다.
	public JourneyService(Optional<MusicDetailReader> detailReader,
			Optional<JourneyPathFinder> pathFinder,
			Optional<JourneyTrackReader> trackReader,
			MeterRegistry meterRegistry) {
		this.detailReader = detailReader;
		this.pathFinder = pathFinder;
		this.trackReader = trackReader;
		this.meterRegistry = meterRegistry;
	}

	/**
	 * 두 곡을 잇는 경로를 만든다 (정본 §3.3).
	 *
	 * @param start 출발곡 ID
	 * @param end   도착곡 ID
	 * @throws CustomException MUSIC_NOT_FOUND(404) 곡 없음 / PATH_NOT_FOUND(422) 경로 없음 /
	 *                         INTERNAL_SERVER_ERROR(500) 엔진 부재·타임아웃·조립 불가
	 */
	public JourneyResponse getJourney(long start, long end) {
		MusicDetailReader reader = detailReader.orElseThrow(
				() -> unavailable("music/journey: 곡 조회 어댑터 대기 중 (B-D)"));

		MusicDetail startSong = findSong(reader, start);

		// 같은 곡이면 축 길이가 0 이라 통로가 성립하지 않는다. 엔진을 부르지 않고 끊는다 (FR-012, research R5)
		if (start == end) {
			return assemble(List.of(startSong));
		}

		MusicDetail endSong = findSong(reader, end);

		EnginePath enginePath = callEngine(startSong, endSong);
		if (!enginePath.reachable()) {
			throw new CustomException(MusicErrorCode.PATH_NOT_FOUND);
		}
		recordQuality(enginePath);

		List<MusicDetail> stations = hydrate(enginePath.stationMbids());

		List<MusicDetail> songs = new ArrayList<>(stations.size() + 2);
		songs.add(startSong);
		songs.addAll(stations);
		songs.add(endSong);
		return assemble(songs);
	}

	private MusicDetail findSong(MusicDetailReader reader, long id) {
		return reader.findDetail(id)
				.orElseThrow(() -> new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));
	}

	/**
	 * 엔진 호출. 구간 지연을 재고, <b>어떤 실패도 422 로 내리지 않는다</b> — 엔진 부재·타임아웃은
	 * 사용자가 곡을 바꿔 해결할 수 있는 실패가 아니다(2026-09-10 clarify).
	 */
	private EnginePath callEngine(MusicDetail start, MusicDetail end) {
		JourneyPathFinder finder = pathFinder.orElseThrow(
				() -> unavailable("music/journey: 경로 산출 구현 대기 중"));

		Timer.Sample sample = Timer.start(meterRegistry);
		try {
			return finder.find(start, end);
		} catch (CustomException e) {
			throw e;
		} catch (RuntimeException e) {
			log.error("journey engine call failed", e);
			throw new CustomException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
		} finally {
			sample.stop(meterRegistry.timer(ENGINE_TIMER));
		}
	}

	/**
	 * 경로 품질을 기록한다. 단조 증가는 엔진이 구조적으로 보장하므로(D10) 여기서 다시 계산해
	 * 응답을 막지 않고 위반을 세기만 한다(FR-020, research R10).
	 *
	 * <p>엔진 메타는 응답에 싣지 않으므로(FR-023) 이 로그가 유일한 경로다.
	 * 곡 제목·사용자 식별자는 남기지 않고, 연속값인 endpointDist 를 지표 태그로 쓰지 않는다.
	 */
	private void recordQuality(EnginePath path) {
		boolean monotonic = path.progressMonotonic();
		if (!monotonic) {
			meterRegistry.counter(MONOTONIC_VIOLATION_COUNTER).increment();
		}
		log.info("journey mode={} bundle={} far={} endpointDist={} stations={} monotonic={}",
				path.mode(), path.bundle(), path.far(), path.endpointDist(),
				path.stationMbids().size(), monotonic);
	}

	/**
	 * 정거장 mbid 를 상세로 채운다. <b>순서는 엔진이 준 mbid 순서를 따른다</b> —
	 * port 는 순서를 보장하지 않는다(research R4, FR-005).
	 */
	private List<MusicDetail> hydrate(List<String> mbids) {
		if (mbids.isEmpty()) {
			// 중복 제거로 중간 정거장이 모두 사라진 경우. 출발·도착 2곡 경로가 정상이다 (FR-009, FR-012)
			return List.of();
		}
		if (new HashSet<>(mbids).size() != mbids.size()) {
			log.error("journey engine returned duplicate stations: {}", mbids.size());
			throw new CustomException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
		}

		JourneyTrackReader tracks = trackReader.orElseThrow(
				() -> unavailable("music/journey: 정거장 조회 어댑터 대기 중 (B-D)"));

		Map<String, MusicDetail> byMbid = tracks.findDetailsByMbids(mbids).stream()
				.collect(Collectors.toMap(MusicDetail::mbid, Function.identity(), (first, dup) -> first));

		List<MusicDetail> ordered = new ArrayList<>(mbids.size());
		for (String mbid : mbids) {
			MusicDetail song = byMbid.get(mbid);
			if (song == null) {
				// 부분 경로를 성공으로 내지 않는다 (FR-014)
				log.error("journey station detail missing for {} of {} mbids", mbids.size() - byMbid.size(),
						mbids.size());
				throw new CustomException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
			}
			ordered.add(song);
		}
		return ordered;
	}

	/**
	 * 최종 목록을 정본 응답으로 만든다. {@code step} 은 0 부터 연속 부여하고 엔진 {@code rank} 를 쓰지 않는다(FR-005).
	 * {@code musicCnt} 는 목록 길이이며 엔진 {@code n_stations} 와 혼용하지 않는다(FR-021).
	 */
	private JourneyResponse assemble(List<MusicDetail> songs) {
		if (songs.size() > MAX_PATH_SIZE) {
			// 계약 상한 위반은 축소하지 않고 실패시킨다 — 엔진 상한이 20 이라 여기 오면 엔진 계약 위반이다 (FR-008)
			log.error("journey path exceeds contract limit: {} > {}", songs.size(), MAX_PATH_SIZE);
			throw new CustomException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
		}
		// 같은 곡 중복(I6)은 hydrate 의 mbid 검사가 잡는다. start == end 는 위에서 끊었고,
		// 엔진은 출발·도착과 같은 canonical 을 후보에서 제외하므로 여기서 다시 볼 것이 없다.
		List<JourneyStop> path = IntStream.range(0, songs.size())
				.mapToObj(i -> new JourneyStop(i, songs.get(i)))
				.toList();
		int totalDuration = songs.stream()
				.mapToInt(song -> song.duration() == null ? 0 : song.duration())
				.sum();
		return new JourneyResponse(path.size(), totalDuration, path);
	}

	private CustomException unavailable(String reason) {
		log.error(reason);
		return new CustomException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
	}
}
