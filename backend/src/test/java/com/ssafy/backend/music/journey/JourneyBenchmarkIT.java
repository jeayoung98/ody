package com.ssafy.backend.music.journey;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

import javax.sql.DataSource;

import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.io.Resources;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import com.ssafy.backend.music.retrieval.SameRecording;
import com.ssafy.backend.music.detail.MusicDetailReaderAdapter;
import com.ssafy.backend.music.dto.JourneyResponse;
import com.ssafy.backend.music.dto.JourneyStop;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.TrackCandidateRow;
import com.ssafy.backend.music.mapper.MusicDetailMapper;
import com.ssafy.backend.music.mapper.NearestTrackMapper;
import com.ssafy.backend.music.retrieval.NearestTrackReader;
import com.ssafy.backend.music.retrieval.ServingRules;
import com.ssafy.backend.music.service.JourneyService;
import com.ssafy.backend.music.retrieval.TrackCandidate;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/**
 * 실 DB 대상 여정 산출 측정 (T047, 수용 기준 AC-J1~J6).
 *
 * <p><b>환경변수가 없으면 통째로 건너뛴다</b> — CI 와 평소 {@code ./gradlew test} 는 영향받지 않는다.
 *
 * <h2>돌리는 법</h2>
 *
 * <p>터미널 1 — SSH 터널(컨테이너 IP 는 {@code docker inspect ody-postgres} 로 확인):
 * <pre>
 * ssh -i ~/.ssh/J15A405T.pem -L 15432:&lt;컨테이너IP&gt;:5432 ubuntu@j15a405.p.ssafy.io
 * </pre>
 *
 * <p>터미널 2 — 자격증명을 환경변수로 주고 실행. <b>값은 이 저장소에 남기지 않는다.</b>
 * <pre>
 * export ODY_DB_URL='jdbc:postgresql://localhost:15432/ody'
 * export ODY_DB_USER='ody_app'
 * export ODY_DB_PASSWORD='...'
 * ./gradlew test --tests '*JourneyBenchmarkIT' -i
 * </pre>
 *
 * <p>Spring 을 띄우지 않는다. Redis·Neo4j·OAuth 가 필요 없고 측정 대상(층 질의 + DP)만 엮는다.
 * 게이트웨이 오버헤드(출발·도착 상세 조회 2회 + 응답 조립)는 여기에 포함되지 않는다 —
 * 종단 예산은 그만큼을 더해 판단한다.
 */
@EnabledIfEnvironmentVariable(named = "ODY_DB_URL", matches = ".+")
class JourneyBenchmarkIT {

	/** 핸드오프 §4.9 AC-J1~J6 이 쓰는 표본 수. */
	private static final int PAIRS = 40;

	/** 재현 가능한 쌍 추출. 참조 구현 벤치마크와 같은 씨앗이다. */
	private static final long SEED = 42;

	/** AC-J5 기준. 종단 3초 예산의 하위 목표다. */
	private static final long P95_BUDGET_MS = 2000;

	/** 전 경로는 조립까지 확인하는 것이 목적이라 표본이 적어도 된다. */
	private static final int FULL_PATH_PAIRS = 5;

	/** 최악 케이스는 질의가 3배라 표본을 줄인다. 분포가 아니라 상한을 보는 측정이다. */
	private static final int WORST_PAIRS = 10;

	/** 종단 3초 예산. 게이트웨이 몫이 따로 붙으므로 여유가 남아야 한다. */
	private static final long WORST_BUDGET_MS = 3000;

	private static final ServingRules RULES =
			new ServingRules("v2.1-pca16", 1.6624, 3, 4.912, 30, 1200, 10.7);

	private static SqlSessionFactory factory;
	private static long maxId;

	/** 운영 매퍼 XML. 인터페이스 옆이 아니라 이 경로에 있어 직접 파싱해야 한다. */
	private static final String[] MAPPER_XMLS = {
			"mapper/music/NearestTrackMapper.xml",
			"mapper/music/MusicDetailMapper.xml",
	};

	@BeforeAll
	static void connect() throws Exception {
		// 드라이버는 runtimeOnly 라 컴파일 시점에 클래스를 못 쓴다. 이름으로 받는 UnpooledDataSource 를 쓴다.
		DataSource ds = new UnpooledDataSource("org.postgresql.Driver",
				System.getenv("ODY_DB_URL"), System.getenv("ODY_DB_USER"), System.getenv("ODY_DB_PASSWORD"));

		Configuration cfg = new Configuration(
				new Environment("it", new JdbcTransactionFactory(), ds));
		cfg.setMapUnderscoreToCamelCase(true);
		// 운영과 같은 SQL 로 재야 하므로 XML 을 그대로 읽는다. 파싱이 namespace 로 인터페이스까지 묶어
		// 주므로 NearestTrackMapper 를 따로 addMapper 하면 중복 등록으로 터진다.
		for (String xml : MAPPER_XMLS) {
			try (java.io.InputStream in = Resources.getResourceAsStream(xml)) {
				new XMLMapperBuilder(in, cfg, xml, cfg.getSqlFragments()).parse();
			}
		}
		cfg.addMapper(BenchMapper.class);
		factory = new SqlSessionFactoryBuilder().build(cfg);

		try (SqlSession s = factory.openSession()) {
			maxId = s.getMapper(BenchMapper.class).maxId();
		}
	}

	@Test
	void journeyMeetsAcceptanceCriteria() {
		Random rnd = new Random(SEED);
		List<Long> latencies = new ArrayList<>(PAIRS);
		int unreachable = 0;
		int monotonicViolations = 0;
		int ruleViolations = 0;
		int farPairs = 0;
		List<Double> stepMedians = new ArrayList<>(PAIRS);

		for (int i = 0; i < PAIRS; i++) {
			try (SqlSession session = factory.openSession()) {
				BenchMapper bench = session.getMapper(BenchMapper.class);
				MusicDetail a = load(bench, rnd);
				MusicDetail b = load(bench, rnd);
				if (a == null || b == null || a.id().equals(b.id())) {
					continue;
				}

				NearestTrackReader reader = adapterOn(session);
				AxisJourneyPathFinder finder =
						new AxisJourneyPathFinder(Optional.of(reader), RULES, new SimpleMeterRegistry(), LayerCandidates.LAYER_LIMIT, 2.5);

				long t0 = System.nanoTime();
				EnginePath path = finder.find(a, b);
				latencies.add((System.nanoTime() - t0) / 1_000_000);

				if (!path.reachable()) {
					unreachable++;
					continue;
				}
				if (path.far()) {
					farPairs++;
				}
				if (!path.progressMonotonic()) {
					monotonicViolations++;
				}
				List<TrackCandidate> stops = resolve(bench, path.stationIds());
				if (violatesRules(stops, a, b)) {
					ruleViolations++;
				}
				stepMedians.add(medianStep(a, stops, b));
			}
		}

		latencies.sort(null);
		long p95 = percentile(latencies);
		stepMedians.sort(null);

		System.out.printf("%n=== T047 / AC-J1~J6 (pairs=%d, seed=%d) ===%n", latencies.size(), SEED);
		System.out.printf("AC-J1 unreachable        : %d%n", unreachable);
		System.out.printf("AC-J2 progress 역행       : %d%n", monotonicViolations);
		System.out.printf("AC-J3/J4 규칙 위반        : %d%n", ruleViolations);
		System.out.printf("AC-J5 지연 p50/p95/max   : %d / %d / %d ms%n",
				latencies.get(latencies.size() / 2), p95, latencies.get(latencies.size() - 1));
		System.out.printf("AC-J6 far 쌍             : %d%n", farPairs);
		System.out.printf("인접 역 거리 median p50  : %.3f%n",
				stepMedians.isEmpty() ? -1 : stepMedians.get(stepMedians.size() / 2));

		assertThat(unreachable).as("AC-J1 경로 없음 0건").isZero();
		assertThat(monotonicViolations).as("AC-J2 진행도 단조 증가").isZero();
		assertThat(ruleViolations).as("AC-J3·J4 규칙 위반 0건").isZero();
		// 이 값은 SSH 터널 왕복을 포함한다 — 운영은 앱과 DB 가 같은 호스트라 더 짧다. 상한으로 읽는다.
		assertThat(p95).as("AC-J5 p95 <= %d ms", P95_BUDGET_MS).isLessThanOrEqualTo(P95_BUDGET_MS);
	}

	/** 정렬된 목록의 p95. 빈 목록은 호출하지 않는다. */
	private static <T> T percentile(List<T> sorted) {
		return sorted.get(Math.min(sorted.size() - 1, (int) (sorted.size() * 0.95)));
	}

	/**
	 * 서비스 계층까지 태우는 전 경로 확인 — 산출만 재는 다른 측정이 못 보는 구간이다.
	 *
	 * <p><b>왜 필요한가.</b> 다른 측정은 {@link AxisJourneyPathFinder} 를 직접 생성해 부른다. 그래서
	 * {@code JourneyTrackReader} 구현체가 없던 동안에도 40쌍이 전부 통과했지만, 실제 요청은
	 * 중간 정거장이 있는 한 전부 500 이었다(2026-09-12). <b>벤치 통과가 API 동작을 뜻하지 않는다.</b>
	 *
	 * <p>컨트롤러는 파라미터를 넘기는 일만 하므로 여기까지가 실질적인 전 경로다.
	 */
	@Test
	void fullServicePathAssemblesResponse() {
		Random rnd = new Random(SEED);
		int checked = 0;

		for (int i = 0; i < FULL_PATH_PAIRS; i++) {
			try (SqlSession session = factory.openSession()) {
				BenchMapper bench = session.getMapper(BenchMapper.class);
				MusicDetail a = load(bench, rnd);
				MusicDetail b = load(bench, rnd);
				if (a == null || b == null || a.id().equals(b.id())) {
					continue;
				}

				JourneyResponse res = serviceOn(session).getJourney(a.id(), b.id());

				assertThat(res.path()).as("경로가 비어 있지 않다").isNotEmpty();
				assertThat(res.musicCnt()).as("musicCnt 는 path 길이다 (FR-021)").isEqualTo(res.path().size());
				assertThat(res.path().size()).as("계약 상한 30 (FR-008)").isLessThanOrEqualTo(30);
				assertThat(res.path().get(0).music().id()).as("첫 원소가 출발곡").isEqualTo(a.id());
				assertThat(res.path().get(res.path().size() - 1).music().id())
						.as("마지막 원소가 도착곡").isEqualTo(b.id());

				for (int k = 0; k < res.path().size(); k++) {
					JourneyStop stop = res.path().get(k);
					assertThat(stop.step()).as("step 은 0 부터 연속 (FR-005)").isEqualTo(k);
					assertThat(stop.music().location()).as("좌표가 채워져 있다 (FR-016)").isNotNull();
					assertThat(stop.music().title()).as("제목이 채워져 있다").isNotNull();
				}
				assertThat(res.path().stream().map(st -> st.music().id()).distinct().count())
						.as("같은 곡이 두 번 나오지 않는다 (I6)").isEqualTo(res.path().size());

				int expected = res.path().stream()
						.mapToInt(st -> st.music().duration() == null ? 0 : st.music().duration()).sum();
				assertThat(res.totalDuration()).as("totalDuration 은 duration 합 (FR-006)").isEqualTo(expected);
				checked++;
			}
		}

		System.out.printf("%n=== 전 경로 확인: %d 쌍 조립 성공 ===%n", checked);
		assertThat(checked).as("최소 한 쌍은 검사했다").isPositive();
	}

	/** 운영과 같은 어댑터·서비스를 실 DB 세션 위에 조립한다. Spring 없이 생성자로만 엮는다. */
	private JourneyService serviceOn(SqlSession session) {
		MusicDetailMapper detailMapper = session.getMapper(MusicDetailMapper.class);
		AxisJourneyPathFinder finder = new AxisJourneyPathFinder(
				Optional.of(adapterOn(session)), RULES, new SimpleMeterRegistry(), LayerCandidates.LAYER_LIMIT, 2.5);
		return new JourneyService(
				Optional.of(new MusicDetailReaderAdapter(detailMapper)),
				Optional.of(finder),
				Optional.of(new JourneyTrackReaderAdapter(detailMapper)),
				new SimpleMeterRegistry());
	}

	/**
	 * B-Latency — 최악 케이스 지연. 층 재질의 상한이 <b>매 층</b> 소진되게 강제한다.
	 *
	 * <p>무작위 표본으로는 이 조합이 안 나온다(후보가 넉넉해 첫 질의에서 끝난다). 그래서 조회 결과를
	 * {@code MIN_LAYER} 미만으로 깎아 재질의를 강제한다 — <b>DB 에 나가는 질의는 실제 그대로</b>라
	 * (limit 200 → 400 → 800, {@code ef_search} 도 같이 오른다) 비용이 줄지 않는다.
	 *
	 * <p>타임아웃이 없으므로 이 값이 곧 산출 지연 상한이다(FR-025). 종단 예산 3초와 비교한다 —
	 * 게이트웨이(상세 조회 2회 + 조립)가 여기에 더 붙는다.
	 */
	@Test
	void worstCaseLatencyStaysWithinBudget() {
		Random rnd = new Random(SEED);
		List<Long> latencies = new ArrayList<>(WORST_PAIRS);

		for (int i = 0; i < WORST_PAIRS; i++) {
			try (SqlSession session = factory.openSession()) {
				BenchMapper bench = session.getMapper(BenchMapper.class);
				MusicDetail a = load(bench, rnd);
				MusicDetail b = load(bench, rnd);
				if (a == null || b == null || a.id().equals(b.id())) {
					continue;
				}

				NearestTrackReader real = adapterOn(session);
				// 늘 부족하게 돌려줘 재질의 상한을 소진시킨다. 질의 자체는 실제로 나간다.
				NearestTrackReader starved = (point, limit) -> {
					List<TrackCandidate> rows = real.findNearest(point, limit);
					return rows.subList(0, Math.min(rows.size(), LayerCandidates.MIN_LAYER - 1));
				};
				AxisJourneyPathFinder finder =
						new AxisJourneyPathFinder(Optional.of(starved), RULES, new SimpleMeterRegistry(), LayerCandidates.LAYER_LIMIT, 2.5);

				long t0 = System.nanoTime();
				finder.find(a, b);
				latencies.add((System.nanoTime() - t0) / 1_000_000);
			}
		}

		latencies.sort(null);
		System.out.printf("%n=== B-Latency 최악 케이스 (쌍 %d, 층마다 재질의 %d회 소진) ===%n",
				latencies.size(), LayerCandidates.MAX_RETRY);
		System.out.printf("p50 / p95 / max : %d / %d / %d ms%n",
				latencies.get(latencies.size() / 2), percentile(latencies),
				latencies.get(latencies.size() - 1));

		assertThat(latencies.get(latencies.size() - 1))
				.as("B-Latency 최악 지연 <= %d ms (종단 3초 예산)", WORST_BUDGET_MS)
				.isLessThanOrEqualTo(WORST_BUDGET_MS);
	}

	/**
	 * SC-005 — 같은 쌍에서 {@code axis} 의 인접 역 거리 median 이 {@code linear} 보다 작다.
	 *
	 * <p>운영 요청 경로가 아니라 이 검증 경로에서만 두 모드를 나란히 돌린다(FR-010).
	 * 데이터 파트 기준선은 p50 2.949 대 3.430 이다(R10).
	 */
	@Test
	void axisStationsAreCloserThanLinear() {
		Random rnd = new Random(SEED);
		List<Double> axisMedians = new ArrayList<>(PAIRS);
		List<Double> linearMedians = new ArrayList<>(PAIRS);
		int axisWins = 0;
		int compared = 0;

		for (int i = 0; i < PAIRS; i++) {
			try (SqlSession session = factory.openSession()) {
				BenchMapper bench = session.getMapper(BenchMapper.class);
				MusicDetail a = load(bench, rnd);
				MusicDetail b = load(bench, rnd);
				if (a == null || b == null || a.id().equals(b.id())) {
					continue;
				}

				NearestTrackReader reader = adapterOn(session);
				AxisJourneyPathFinder finder =
						new AxisJourneyPathFinder(Optional.of(reader), RULES, new SimpleMeterRegistry(), LayerCandidates.LAYER_LIMIT, 2.5);

				EnginePath axis = finder.find(a, b);
				if (!axis.reachable() || axis.stationIds().isEmpty()) {
					continue;
				}
				List<TrackCandidate> linear = linearStops(finder, reader, a, b);
				if (linear == null || linear.isEmpty()) {
					continue;
				}

				double am = medianStep(a, resolve(bench, axis.stationIds()), b);
				double lm = medianStep(a, linear, b);
				axisMedians.add(am);
				linearMedians.add(lm);
				compared++;
				if (am < lm) {
					axisWins++;
				}
			}
		}

		axisMedians.sort(null);
		linearMedians.sort(null);
		System.out.printf("%n=== SC-005 axis 대 linear (쌍 %d) ===%n", compared);
		System.out.printf("axis   median p50 / p95 : %.3f / %.3f%n",
				axisMedians.get(axisMedians.size() / 2), percentile(axisMedians));
		System.out.printf("linear median p50 / p95 : %.3f / %.3f%n",
				linearMedians.get(linearMedians.size() / 2), percentile(linearMedians));
		System.out.printf("쌍별 axis 승             : %d / %d%n", axisWins, compared);

		assertThat(axisMedians.get(axisMedians.size() / 2))
				.as("SC-005 axis median p50 < linear median p50")
				.isLessThan(linearMedians.get(linearMedians.size() / 2));
	}

	/** {@code linear} 를 폴백이 아니라 직접 불러 같은 쌍을 두 모드로 잰다. */
	private List<TrackCandidate> linearStops(AxisJourneyPathFinder finder, NearestTrackReader reader,
			MusicDetail a, MusicDetail b) {
		float[] av = a.location().toArray();
		float[] bv = b.location().toArray();
		AxisFrame frame = AxisFrame.of(av, bv);
		if (frame.degenerate()) {
			return null;
		}
		LayerCandidates.EndpointGuard guard = new LayerCandidates.EndpointGuard(a.id(), b.id(),
				SameRecording.key(a.title(), a.artist()), SameRecording.key(b.title(), b.artist()),
				av, bv, new HashSet<>());
		return finder.linear(reader, frame, guard,
				frame.stationCount(2.5, AxisJourneyPathFinder.MAX_STATIONS));
	}

	// ------------------------------------------------------------------ 보조

	private MusicDetail load(BenchMapper bench, Random rnd) {
		TrackCandidateRow row = bench.findById(1 + (long) (rnd.nextDouble() * maxId));
		if (row == null) {
			return null;
		}
		float[] v = row.toVec();
		Location l = new Location(v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7],
				v[8], v[9], v[10], v[11], v[12], v[13], v[14], v[15]);
		return new MusicDetail(row.getMusicId(), row.getMbid(), row.getTitle(), row.getArtist(),
				null, row.getDuration(), null, null, List.of(), null, null, l, 0, 0);
	}

	private NearestTrackReader adapterOn(SqlSession session) {
		NearestTrackMapper mapper = session.getMapper(NearestTrackMapper.class);
		return (point, limit) -> {
			mapper.raiseEfSearch(Math.max(200, limit));
			return mapper.findNearest(literal(point), limit).stream()
					.map(r -> new TrackCandidate(r.getMusicId(), r.getMbid(), r.getTitle(),
							r.getArtist(), r.getDuration(), r.toVec(), r.getDist()))
					.toList();
		};
	}

	private static String literal(float[] p) {
		StringBuilder sb = new StringBuilder("[");
		for (int i = 0; i < p.length; i++) {
			sb.append(i == 0 ? "" : ",").append(p[i]);
		}
		return sb.append(']').toString();
	}

	/** 한 번에 묶어 읽고 경로 순서로 되돌린다 — id 낱개 조회는 왕복이 역 수만큼 난다. */
	private List<TrackCandidate> resolve(BenchMapper bench, List<Long> ids) {
		Map<Long, TrackCandidate> byId = new HashMap<>();
		for (TrackCandidateRow r : bench.findByIds(ids)) {
			byId.put(r.getMusicId(), new TrackCandidate(r.getMusicId(), r.getMbid(), r.getTitle(),
					r.getArtist(), r.getDuration(), r.toVec(), 0));
		}
		List<TrackCandidate> out = new ArrayList<>(ids.size());
		for (Long id : ids) {
			out.add(byId.get(id));
		}
		return out;
	}

	/** AC-J3 인접 역 거리 >= tau_dup · AC-J4 아티스트 상한·같은 녹음 중복. */
	private boolean violatesRules(List<TrackCandidate> stops, MusicDetail a, MusicDetail b) {
		Map<String, Integer> byArtist = new HashMap<>();
		for (TrackCandidate c : stops) {
			if (c.artist() != null) {
				byArtist.merge(c.artist(), 1, Integer::sum);
			}
		}
		if (byArtist.values().stream().anyMatch(n -> n > RULES.artistCap())) {
			return true;
		}
		if (stops.stream().map(TrackCandidate::id).distinct().count() != stops.size()) {
			return true;
		}
		float[] prev = a.location().toArray();
		for (TrackCandidate c : stops) {
			if (c.distanceTo(prev) < RULES.tauDup()) {
				return true;
			}
			prev = c.vec();
		}
		return dist(prev, b.location().toArray()) < RULES.tauDup();
	}

	private double medianStep(MusicDetail a, List<TrackCandidate> stops, MusicDetail b) {
		List<Double> steps = new ArrayList<>();
		float[] prev = a.location().toArray();
		for (TrackCandidate c : stops) {
			steps.add(c.distanceTo(prev));
			prev = c.vec();
		}
		steps.add(dist(prev, b.location().toArray()));
		steps.sort(Comparator.naturalOrder());
		return steps.get(steps.size() / 2);
	}

	private static double dist(float[] x, float[] y) {
		double s = 0;
		for (int i = 0; i < x.length; i++) {
			double d = x[i] - y[i];
			s += d * d;
		}
		return Math.sqrt(s);
	}

	/** 측정 전용 조회. 운영 코드에 넣지 않는다. */
	public interface BenchMapper {

		@org.apache.ibatis.annotations.Select("SELECT max(id) FROM music")
		long maxId();

		@org.apache.ibatis.annotations.Select("""
				SELECT id AS music_id, mbid, title, artist, duration, 0 AS dist,
				  (location::real[])[1] AS pc1, (location::real[])[2] AS pc2,
				  (location::real[])[3] AS pc3, (location::real[])[4] AS pc4,
				  (location::real[])[5] AS pc5, (location::real[])[6] AS pc6,
				  (location::real[])[7] AS pc7, (location::real[])[8] AS pc8,
				  (location::real[])[9] AS pc9, (location::real[])[10] AS pc10,
				  (location::real[])[11] AS pc11, (location::real[])[12] AS pc12,
				  (location::real[])[13] AS pc13, (location::real[])[14] AS pc14,
				  (location::real[])[15] AS pc15, (location::real[])[16] AS pc16
				FROM music WHERE id = #{id}""")
		TrackCandidateRow findById(long id);

		@org.apache.ibatis.annotations.Select("""
				<script>
				SELECT id AS music_id, mbid, title, artist, duration, 0 AS dist,
				  (location::real[])[1] AS pc1, (location::real[])[2] AS pc2,
				  (location::real[])[3] AS pc3, (location::real[])[4] AS pc4,
				  (location::real[])[5] AS pc5, (location::real[])[6] AS pc6,
				  (location::real[])[7] AS pc7, (location::real[])[8] AS pc8,
				  (location::real[])[9] AS pc9, (location::real[])[10] AS pc10,
				  (location::real[])[11] AS pc11, (location::real[])[12] AS pc12,
				  (location::real[])[13] AS pc13, (location::real[])[14] AS pc14,
				  (location::real[])[15] AS pc15, (location::real[])[16] AS pc16
				FROM music WHERE id IN
				<foreach item="m" collection="ids" open="(" separator="," close=")">#{m}</foreach>
				</script>""")
		List<TrackCandidateRow> findByIds(@org.apache.ibatis.annotations.Param("ids") List<Long> ids);
	}
}
