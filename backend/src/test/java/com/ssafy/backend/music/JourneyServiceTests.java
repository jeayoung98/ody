package com.ssafy.backend.music;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.JourneyResponse;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.journey.EnginePath;
import com.ssafy.backend.music.journey.JourneyPathFinder;
import com.ssafy.backend.music.journey.JourneyTrackReader;
import com.ssafy.backend.music.service.JourneyService;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/**
 * 경로 탐색 게이트웨이 서비스 유닛 (mock port). quickstart B절 + data-model §6 불변식 I1~I9.
 *
 * <p>검증 범위는 <b>조립</b>이다. 축 통로·Viterbi·후처리 규칙은 {@code AxisJourneyPathFinder} 가
 * 수행하고 {@code AxisJourneyPathFinderTests}·{@code ViterbiPathTests} 가 검증한다(rev.3 인프로세스 전환).
 * 여기서는 산출을 mock 으로 두고 조립·오류 매핑만 본다 — 응답 계약이 그대로이므로 이 파일은 전환 전후로 같다.
 */
class JourneyServiceTests {

	private static final long START_ID = 10234L;
	private static final long END_ID = 10877L;
	private static final String START_MBID = "aaaaaaaa-start";
	private static final String END_MBID = "zzzzzzzz-end";

	private MusicDetailReader detailReader;
	private JourneyPathFinder pathFinder;
	private JourneyTrackReader trackReader;
	private MeterRegistry meterRegistry;
	private JourneyService service;

	@BeforeEach
	void setUp() {
		detailReader = mock(MusicDetailReader.class);
		pathFinder = mock(JourneyPathFinder.class);
		trackReader = mock(JourneyTrackReader.class);
		meterRegistry = new SimpleMeterRegistry();
		service = new JourneyService(Optional.of(detailReader), Optional.of(pathFinder),
				Optional.of(trackReader), meterRegistry);
	}

	// ---------------------------------------------------------------- helpers

	private static Location loc(double pc1) {
		return new Location(pc1, 1.0872, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.123);
	}

	private static MusicDetail song(long id, String mbid, Integer duration) {
		return new MusicDetail(id, mbid, "title-" + id, "artist-" + id, 128.4, duration, "album",
				List.of("K-Pop"), "https://youtu.be/" + id, null, loc(id * 0.001), 1428, 3);
	}

	/** 중간 정거장 n개를 mbid "s0".."s(n-1)" 로 만든다. duration 은 전부 100초. */
	private static List<MusicDetail> stations(int n) {
		return IntStream.range(0, n).mapToObj(i -> song(1000L + i, "s" + i, 100)).toList();
	}

	private static List<String> mbidsOf(List<MusicDetail> songs) {
		return songs.stream().map(MusicDetail::mbid).toList();
	}

	private static List<Long> idsOf(List<MusicDetail> songs) {
		return songs.stream().map(MusicDetail::id).toList();
	}

	private static EnginePath enginePath(List<Long> stationIds) {
		List<Double> progresses = IntStream.range(0, stationIds.size())
				.mapToObj(i -> (i + 1.0) / (stationIds.size() + 1.0)).toList();
		return new EnginePath(true, stationIds, progresses, 8.4, false, "axis", "v2.1-pca16");
	}

	/** 출발·도착 상세와 엔진 경로를 준비한다. reader 는 정거장을 <b>뒤섞어</b> 돌려준다(순서 미보장 계약). */
	private List<MusicDetail> givenJourney(int stationCount, Integer startDuration, Integer endDuration) {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, startDuration)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.of(song(END_ID, END_MBID, endDuration)));

		List<MusicDetail> ordered = stations(stationCount);
		when(pathFinder.find(any(MusicDetail.class), any(MusicDetail.class))).thenReturn(enginePath(idsOf(ordered)));

		List<MusicDetail> shuffled = new ArrayList<>(ordered);
		Collections.reverse(shuffled);
		when(trackReader.findDetailsByIds(anyList())).thenReturn(shuffled);
		return ordered;
	}

	// ------------------------------------------------------------ B1~B5 조립

	@Test
	void journey_stationOrder_followsEngineNotReaderOrder() {
		List<MusicDetail> ordered = givenJourney(10, 275, 205);

		JourneyResponse res = service.getJourney(START_ID, END_ID);

		// I7: reader 가 역순으로 줬어도 정거장 순서는 엔진 순서
		List<String> expected = new ArrayList<>();
		expected.add(START_MBID);
		expected.addAll(mbidsOf(ordered));
		expected.add(END_MBID);
		assertThat(res.path().stream().map(stop -> stop.music().mbid())).containsExactlyElementsOf(expected);
	}

	@Test
	void journey_stepIsZeroBasedAndContiguous() {
		givenJourney(10, 275, 205);

		JourneyResponse res = service.getJourney(START_ID, END_ID);

		// I1
		assertThat(res.path()).hasSize(12);
		assertThat(res.path().get(0).step()).isZero();
		for (int i = 0; i < res.path().size(); i++) {
			assertThat(res.path().get(i).step()).isEqualTo(i);
		}
	}

	@Test
	void journey_endpointsArePreserved() {
		givenJourney(10, 275, 205);

		JourneyResponse res = service.getJourney(START_ID, END_ID);

		// I2
		assertThat(res.path().get(0).music().id()).isEqualTo(START_ID);
		assertThat(res.path().get(res.path().size() - 1).music().id()).isEqualTo(END_ID);
	}

	@Test
	void journey_musicCntEqualsPathSize() {
		givenJourney(10, 275, 205);

		JourneyResponse res = service.getJourney(START_ID, END_ID);

		// I3: n_stations + 2
		assertThat(res.musicCnt()).isEqualTo(res.path().size()).isEqualTo(12);
	}

	@Test
	void journey_totalDurationSumsAllStops() {
		givenJourney(10, 275, 205);

		JourneyResponse res = service.getJourney(START_ID, END_ID);

		// I4: 275 + (10 * 100) + 205
		assertThat(res.totalDuration()).isEqualTo(1480);
	}

	// -------------------------------------------------------- B6~B7 null 허용

	@Test
	void journey_nullDurationCountsAsZero() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, null)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.of(song(END_ID, END_MBID, 205)));
		when(pathFinder.find(any(MusicDetail.class), any(MusicDetail.class))).thenReturn(enginePath(List.of(1000L)));
		when(trackReader.findDetailsByIds(anyList()))
				.thenReturn(List.of(song(1000L, "s0", null)));

		JourneyResponse res = service.getJourney(START_ID, END_ID);

		assertThat(res.totalDuration()).isEqualTo(205);
		assertThat(res.musicCnt()).isEqualTo(3);
	}

	@Test
	void journey_notPlayableStationIsKept() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, 275)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.of(song(END_ID, END_MBID, 205)));
		when(pathFinder.find(any(MusicDetail.class), any(MusicDetail.class))).thenReturn(enginePath(List.of(1000L)));
		MusicDetail notPlayable = new MusicDetail(1000L, "s0", "t", "a", 128.4, 100, "al",
				List.of("K-Pop"), null, null, loc(0.5), 1, 0);
		when(trackReader.findDetailsByIds(anyList())).thenReturn(List.of(notPlayable));

		JourneyResponse res = service.getJourney(START_ID, END_ID);

		assertThat(res.path()).hasSize(3);
		assertThat(res.path().get(1).music().youtubeUrl()).isNull();
	}

	// --------------------------------------------------- B11~B12 품질 관측·검산

	@Test
	void journey_nonMonotonicProgress_passesButCounts() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, 275)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.of(song(END_ID, END_MBID, 205)));
		// 진행도가 뒤로 감 — linear 모드가 40쌍 중 21쌍에서 내는 현상(D10 근거)
		when(pathFinder.find(any(MusicDetail.class), any(MusicDetail.class))).thenReturn(new EnginePath(true,
				List.of(1000L, 1001L), List.of(0.7, 0.3), 8.4, false, "axis", "v2.1-pca16"));
		when(trackReader.findDetailsByIds(anyList()))
				.thenReturn(List.of(song(1000L, "s0", 100), song(1001L, "s1", 100)));

		JourneyResponse res = service.getJourney(START_ID, END_ID);

		// 응답은 막지 않는다 (FR-020)
		assertThat(res.musicCnt()).isEqualTo(4);
		assertThat(meterRegistry.counter("ody.journey.progress.not_monotonic").count()).isEqualTo(1.0);
	}

	@Test
	void journey_monotonicProgress_doesNotCount() {
		givenJourney(10, 275, 205);

		service.getJourney(START_ID, END_ID);

		assertThat(meterRegistry.counter("ody.journey.progress.not_monotonic").count()).isZero();
	}

	@Test
	void journey_engineRecordsLatency() {
		givenJourney(10, 275, 205);

		service.getJourney(START_ID, END_ID);

		assertThat(meterRegistry.timer("ody.journey.engine").count()).isEqualTo(1L);
	}

	@Test
	void journey_duplicateStationFromEngine_fails() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, 275)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.of(song(END_ID, END_MBID, 205)));
		when(pathFinder.find(any(MusicDetail.class), any(MusicDetail.class))).thenReturn(enginePath(List.of(1000L, 1000L)));
		when(trackReader.findDetailsByIds(anyList())).thenReturn(List.of(song(1000L, "s0", 100)));

		// I6: 같은 곡이 두 번 나오는 응답을 내지 않는다
		assertThatThrownBy(() -> service.getJourney(START_ID, END_ID))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode().getCode())
				.isEqualTo("INTERNAL_SERVER_ERROR");
	}

	// ------------------------------------------------------------- 경계 (US3)

	@Test
	void journey_sameStartAndEnd_shortCircuitsWithoutEngine() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, 275)));

		JourneyResponse res = service.getJourney(START_ID, START_ID);

		assertThat(res.musicCnt()).isEqualTo(1);
		assertThat(res.path()).hasSize(1);
		assertThat(res.path().get(0).step()).isZero();
		assertThat(res.path().get(0).music().id()).isEqualTo(START_ID);
		assertThat(res.totalDuration()).isEqualTo(275);
		// 엔진·정거장 조회를 쓰지 않는다 (research R5)
		verifyNoInteractions(pathFinder, trackReader);
	}

	/**
	 * 정거장이 하나도 없는 경우. 원래는 "중복 제거로 전부 사라진" 예외 상황이었는데,
	 * 007(S15P21A405-286)부터 <b>끝점이 최근접 반경보다 가까우면 정상적으로 여기 온다</b>.
	 */
	@Test
	void journey_noIntermediateStations_returnsTwoSongPath() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, 275)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.of(song(END_ID, END_MBID, 205)));
		when(pathFinder.find(any(MusicDetail.class), any(MusicDetail.class))).thenReturn(enginePath(List.of()));

		JourneyResponse res = service.getJourney(START_ID, END_ID);

		assertThat(res.musicCnt()).isEqualTo(2);
		assertThat(res.totalDuration()).isEqualTo(480);
		// 조회할 mbid 가 없으면 reader 를 부르지 않는다
		verify(trackReader, never()).findDetailsByIds(anyList());
	}

	@Test
	void journey_engineUpperBound_eighteenStations_isAccepted() {
		givenJourney(18, 275, 205);

		JourneyResponse res = service.getJourney(START_ID, END_ID);

		// B8: 정거장 18개 → 20곡. 축소 없음 (007 로 상한이 20→18 로 내려갔다)
		assertThat(res.musicCnt()).isEqualTo(20);
		assertThat(res.path()).hasSize(20);
	}

	@Test
	void journey_over30Songs_failsInsteadOfTruncating() {
		givenJourney(29, 275, 205);

		// B9/I5: 계약 상한 위반은 축소하지 않고 실패시킨다
		assertThatThrownBy(() -> service.getJourney(START_ID, END_ID))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode().getCode())
				.isEqualTo("INTERNAL_SERVER_ERROR");
	}

	// -------------------------------------------------------------- 실패 (US4)

	@Test
	void journey_startNotFound_throwsMusicNotFound() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.getJourney(START_ID, END_ID))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode().getCode())
				.isEqualTo("MUSIC_NOT_FOUND");
		verifyNoInteractions(pathFinder);
	}

	@Test
	void journey_endNotFound_throwsMusicNotFound() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, 275)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.getJourney(START_ID, END_ID))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode().getCode())
				.isEqualTo("MUSIC_NOT_FOUND");
		verifyNoInteractions(pathFinder);
	}

	@Test
	void journey_unreachable_throwsPathNotFound() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, 275)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.of(song(END_ID, END_MBID, 205)));
		when(pathFinder.find(any(MusicDetail.class), any(MusicDetail.class))).thenReturn(
				new EnginePath(false, List.of(), List.of(), 21.0, true, "axis", null));

		assertThatThrownBy(() -> service.getJourney(START_ID, END_ID))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode().getCode())
				.isEqualTo("PATH_NOT_FOUND");
	}

	@Test
	void journey_missingStationDetail_failsInsteadOfPartialPath() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, 275)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.of(song(END_ID, END_MBID, 205)));
		when(pathFinder.find(any(MusicDetail.class), any(MusicDetail.class))).thenReturn(enginePath(List.of(1000L, 1001L)));
		// B10: 2건 요청했는데 1건만 온다
		when(trackReader.findDetailsByIds(anyList())).thenReturn(List.of(song(1000L, "s0", 100)));

		assertThatThrownBy(() -> service.getJourney(START_ID, END_ID))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode().getCode())
				.isEqualTo("INTERNAL_SERVER_ERROR");
	}

	@Test
	void journey_computeThrows_becomesInternalErrorNot422() {
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, 275)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.of(song(END_ID, END_MBID, 205)));
		when(pathFinder.find(any(MusicDetail.class), any(MusicDetail.class))).thenThrow(new RuntimeException("connect timed out"));

		// 산출 실패(조회 어댑터 부재·재산출 상한 소진)를 422 로 내리지 않는다 — 곡을 바꿔 풀 수 있는 실패가 아니다
		assertThatThrownBy(() -> service.getJourney(START_ID, END_ID))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode().getCode())
				.isEqualTo("INTERNAL_SERVER_ERROR");
	}

	@Test
	void journey_pathFinderAbsent_becomesInternalErrorNot422() {
		JourneyService noEngine = new JourneyService(Optional.of(detailReader), Optional.empty(),
				Optional.of(trackReader), meterRegistry);
		when(detailReader.findDetail(START_ID)).thenReturn(Optional.of(song(START_ID, START_MBID, 275)));
		when(detailReader.findDetail(END_ID)).thenReturn(Optional.of(song(END_ID, END_MBID, 205)));

		assertThatThrownBy(() -> noEngine.getJourney(START_ID, END_ID))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode().getCode())
				.isEqualTo("INTERNAL_SERVER_ERROR");
	}


	// ------------------------------------------------- FR-013 / SC-006 결정성

	@Test
	void journey_repeatedCalls_returnIdenticalPath() {
		givenJourney(10, 275, 205);

		JourneyResponse first = service.getJourney(START_ID, END_ID);
		JourneyResponse second = service.getJourney(START_ID, END_ID);

		// 같은 두 곡·같은 번들이면 목록도 순서도 같아야 한다. reader 가 순서를 보장하지 않으므로
		// 재조립이 Map 순회 순서에 의존하면 여기서 깨진다.
		assertThat(second).isEqualTo(first);
	}

	// -------------------------------------------------------- I8 순수 조회

	@Test
	void journey_isReadOnly_noWriteInteractions() {
		givenJourney(10, 275, 205);

		service.getJourney(START_ID, END_ID);

		// 조회 4회 외의 상호작용이 없어야 한다. findNeighbors 도 부르지 않는다(이 기능 범위 밖)
		verify(detailReader).findDetail(START_ID);
		verify(detailReader).findDetail(END_ID);
		// 산출에 넘기는 것이 조회해 온 상세 그대로여야 한다 — 좌표·아티스트가 축 좌표계와 같은 녹음 판정에 쓰인다
		verify(pathFinder).find(song(START_ID, START_MBID, 275), song(END_ID, END_MBID, 205));
		verify(trackReader).findDetailsByIds(anyList());
		verifyNoMoreInteractions(detailReader, pathFinder, trackReader);
	}
}
