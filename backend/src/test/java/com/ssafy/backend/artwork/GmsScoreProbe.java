package com.ssafy.backend.artwork;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.artwork.dto.ArtworkPointRow;
import com.ssafy.backend.artwork.evaluation.ArtworkAnchor;
import com.ssafy.backend.artwork.evaluation.ArtworkEvaluation;
import com.ssafy.backend.artwork.evaluation.GmsEvaluationClient;
import com.ssafy.backend.artwork.render.ArtworkRenderer;

/**
 * <b>테스트가 아니라 진단 도구다</b> (S15P21A405-563).
 *
 * <p>실제 GMS 를 부른다. 확인하려는 것은 둘이다.
 * <ol>
 *   <li><b>변별력</b> — 고양이다운 정도가 다른 그림들이 그 순서대로 점수를 받는가. 점수가 모양과
 *       무관하게 뭉치면 리더보드가 성립하지 않는다.</li>
 *   <li><b>재현성</b> — 같은 그림을 두 번 보내면 같은 점수인가 ({@code temperature 0}).</li>
 * </ol>
 * 단위 테스트는 GMS 를 스텁으로 때리므로 이 둘에 답하지 못한다.
 *
 * <p>키가 없으면 채점은 <b>건너뛰고 PNG 만 남긴다</b>. CI 와 평소 {@code ./gradlew test} 에서
 * 외부 호출이 일어나지 않게 하려는 것이다. 키는 {@code backend/.env} 의 {@code GMS_API_KEY} 에서 읽는다.
 *
 * <pre>
 * ./gradlew test --tests "com.ssafy.backend.artwork.GmsScoreProbe" -i
 * </pre>
 *
 * <p>렌더한 PNG 는 {@code build/artwork-probe/} 에 남는다 — 점수가 이상하면 눈으로 먼저 본다.
 */
class GmsScoreProbe {

	private static final Path ENV_FILE = Path.of(".env");
	private static final Path OUT_DIR = Path.of("build", "artwork-probe");

	/** {@code artwork_002_anchors.sql} 의 1회차 {@code theme_prompt}(v6) 와 같은 문장. 한쪽만 바꾸면 진단이 실물과 달라진다. */
	static final String THEME_PROMPT = """
			이 그림들은 음악 플레이리스트의 곡들을 점으로 찍고 순서대로 선으로 이은 별자리다.
			배치가 고양이로 보이는지만 판단하라. 선의 굵기나 그림 솜씨는 평가 대상이 아니다.

			점수 구간:
			- 90~100: 설명 없이 한눈에 고양이다. 귀·머리·몸통·꼬리가 제자리에 있고 비율도 맞다
			- 70~89: 고양이로 보인다. 네 부위가 다 있으나 비율이나 배치가 어색하다
			- 50~69: 고양이라고 말해주면 그렇게 보인다. 부위 하나가 빠졌다
			- 30~49: 부위 둘 이상이 빠졌거나, 부위는 있으나 서로 엉뚱한 자리라 고양이로 안 보인다
			- 10~29: 부위 하나 정도만 고양이를 연상시킨다
			- 0~9: 닫힌 형태가 하나도 없는 점 흩어짐이나 선 하나다

			반드시 지킬 상한: 꼬리가 없으면 69 이하. 부위가 둘 이상 없으면 49 이하. 닫힌 형태가 없으면 9 이하.
			부위가 다 있어도 서로 엉뚱한 자리면 49 이하.

			먼저 기준 그림들과 그 점수를 본다. 그 다음 마지막 그림을 기준 그림과 비교해 채점한다.
			기준 그림에서 꼬리가 어디 붙어 있는지, 머리가 몸통 어느 쪽에 있는지를 눈여겨보고, 마지막 그림에 같은 부위가 같은 자리에 있는지 하나씩 대조하라.
			없는 것을 있다고 보지 마라. 애매하면 낮은 쪽을 준다.""";

	/** 그림 이름 → 기대 점수대. 진단 출력에 같이 찍어 눈으로 대조한다. */
	/**
	 * 기대 점수대는 <b>그림이 실제로 어떻게 보이는가</b>로 붙였다. 의도("고양이를 그리려 했다")로 붙이면
	 * 모델이 맞는지 틀린지 가릴 수 없다. 절대값보다 <b>순서</b>가 진짜 검증이다 —
	 * best > full > awkward ≥ no_tail > head_only > line/scatter.
	 */
	static Map<String, String> expectations() {
		Map<String, String> m = new LinkedHashMap<>();
		m.put("cat_best", "90~100 (23점, 앉은 옆모습)");
		m.put("cat_best_again", "cat_best 와 같아야 (temp 0)");
		m.put("cat_best_no_tail", "50~69 (best 에서 꼬리 제거)");
		m.put("cat_best_scrambled", "<50 (best 부위 자리 이동)");
		m.put("scatter2", "0~9 (난수 seed 7)");
		m.put("cat_full", "70~89 (18점 성긴 스케치)");
		m.put("cat_awkward", "50~79 (귀 과대·몸통 짧음)");
		m.put("cat_no_tail", "50~69");
		m.put("cat_scrambled", "<50 (부위 다 있음, 자리 엉망)");
		m.put("cat_head_only", "10~29");
		m.put("line", "0~9");
		m.put("scatter", "0~9");
		return m;
	}

	static Map<String, List<ArtworkPointRow>> shapes() {
		Map<String, List<ArtworkPointRow>> m = new LinkedHashMap<>();
		m.put("cat_best", catBest());
		m.put("cat_best_again", catBest());
		// few-shot 진단용 시험 세트 — 기준 그림(cat_full 계열)과 다른 계열이어야 유출이 없다.
		m.put("cat_best_no_tail", catBestNoTail());
		m.put("cat_best_scrambled", catBestScrambled());
		m.put("scatter2", scatter(7));
		m.put("cat_full", catFull());
		m.put("cat_awkward", catAwkward());
		m.put("cat_no_tail", catNoTail());
		m.put("cat_scrambled", catScrambled());
		m.put("cat_head_only", catHeadOnly());
		m.put("line", line());
		m.put("scatter", scatter());
		return m;
	}

	@Test
	void printsScoresForKnownShapes() throws IOException {
		Map<String, String> env = readEnv();
		String apiKey = env.getOrDefault("GMS_API_KEY", "");

		ArtworkRenderer renderer = new ArtworkRenderer(512, 0.016, 0.006f);
		Files.createDirectories(OUT_DIR);

		Map<String, List<ArtworkPointRow>> shapes = shapes();
		// 키가 없어도 PNG 는 남긴다 — 그림만 따로 들고 나가 다른 데서 채점할 수 있게 하려는 것이다.
		for (Map.Entry<String, List<ArtworkPointRow>> shape : shapes.entrySet()) {
			Files.write(OUT_DIR.resolve(shape.getKey() + ".png"), renderer.render(shape.getValue()));
		}
		System.out.println("PNG: " + OUT_DIR.toAbsolutePath());
		writeAnchorSql(shapes);

		Assumptions.assumeTrue(!apiKey.isBlank(),
				"backend/.env 에 GMS_API_KEY 가 없어 채점은 건너뛴다. PNG 는 위 경로에 남았다.");

		String model = env.getOrDefault("GMS_MODEL", "gpt-4o-mini");
		GmsEvaluationClient client = new GmsEvaluationClient(
				env.getOrDefault("GMS_BASE_URL", "https://gms.ssafy.io/gmsapi/api.openai.com"),
				apiKey, model, env.getOrDefault("GMS_IMAGE_DETAIL", "low"), 3000, 30000);

		// 운영과 같은 기준 그림 4장 (v6). 기준과 시험이 같은 그림이면 그 행은 유출이라 점수를 믿지 않는다.
		List<ArtworkAnchor> anchors = List.of(
				new ArtworkAnchor(renderer.render(shapes.get("cat_full")), 75),
				new ArtworkAnchor(renderer.render(shapes.get("cat_no_tail")), 55),
				new ArtworkAnchor(renderer.render(shapes.get("cat_scrambled")), 35),
				new ArtworkAnchor(renderer.render(shapes.get("scatter")), 5));

		Map<String, String> expectations = expectations();
		System.out.println("=== GMS 점수 진단 (model=" + model + ", anchors=4) ===");
		System.out.printf("%-16s %5s  %-28s %7s  %s%n", "shape", "score", "expected", "time", "comment");
		for (Map.Entry<String, List<ArtworkPointRow>> shape : shapes.entrySet()) {
			byte[] png = renderer.render(shape.getValue());
			long startedAt = System.currentTimeMillis();
			Optional<ArtworkEvaluation> result = client.evaluate(png, THEME_PROMPT, anchors);
			long elapsed = System.currentTimeMillis() - startedAt;

			System.out.printf("%-16s %5s  %-28s %5dms  %s%n",
					shape.getKey(),
					result.map(e -> String.valueOf(e.score())).orElse("실패"),
					expectations.get(shape.getKey()),
					elapsed,
					result.map(ArtworkEvaluation::comment).orElse("-"));
		}
	}

	/**
	 * 기준 그림 4장을 {@code artwork} 행으로 넣는 SQL 을 뽑는다 → {@code build/artwork-probe/anchors.sql}.
	 * v6 진단에서 쓴 것과 같은 그림·점수다. 회차 DDL(`artwork_002_anchors.sql`)이 이 출력을 그대로 담는다.
	 */
	private static void writeAnchorSql(Map<String, List<ArtworkPointRow>> shapes) throws IOException {
		String[][] anchors = {{"cat_full", "75"}, {"cat_no_tail", "55"}, {"cat_scrambled", "35"}, {"scatter", "5"}};
		StringBuilder sql = new StringBuilder();
		for (String[] anchor : anchors) {
			String name = anchor[0];
			sql.append("-- 기준 그림 ").append(name).append(" (").append(anchor[1]).append("점)\n");
			sql.append("INSERT INTO public.artwork (id, round_id, email, title, layout_version, status, score, ai_comment, model, is_anchor, evaluated_at)\n");
			sql.append("SELECT nextval('artwork_id_seq'), r.id, 'anchor@ody.system', '기준 ").append(name)
					.append("', 'probe', 'SCORED', ").append(anchor[1]).append(", NULL, 'fixed', true, now()\n");
			sql.append("FROM public.artwork_round r WHERE r.theme = '고양이'\n");
			sql.append("  AND NOT EXISTS (SELECT 1 FROM public.artwork a WHERE a.round_id = r.id AND a.is_anchor AND a.title = '기준 ")
					.append(name).append("');\n");
			sql.append("INSERT INTO public.artwork_point (artwork_id, position, music_id, x, y)\nSELECT a.id, p.position, 0, p.x, p.y\nFROM public.artwork a, (VALUES\n");
			List<ArtworkPointRow> points = shapes.get(name);
			for (int i = 0; i < points.size(); i++) {
				ArtworkPointRow p = points.get(i);
				sql.append(String.format(java.util.Locale.ROOT, "  (%d, %.4f, %.4f)%s\n",
						p.getPosition(), p.getX(), p.getY(), i < points.size() - 1 ? "," : ""));
			}
			sql.append(") AS p(position, x, y)\nWHERE a.is_anchor AND a.title = '기준 ").append(name)
					.append("'\n  AND NOT EXISTS (SELECT 1 FROM public.artwork_point q WHERE q.artwork_id = a.id);\n\n");
		}
		Files.writeString(OUT_DIR.resolve("anchors.sql"), sql.toString(), StandardCharsets.UTF_8);
	}

	// ---------------------------------------------------------------------------------------
	// 그림들. 좌표는 -1~1, y 는 위가 양수. 선은 position 순서대로 잇는다.
	// 머리는 왼쪽 위 고리, 몸통은 오른쪽 고리, 꼬리는 몸통 뒤에서 위로 휘는 가지.
	// ---------------------------------------------------------------------------------------

	private static final double[][] HEAD = {
		{-0.30, 0.20},   // 목 (머리 고리 시작·끝)
		{-0.55, 0.02},   // 턱
		{-0.76, 0.14},   // 왼 뺨 아래
		{-0.80, 0.42},   // 왼 뺨
		{-0.68, 0.80},   // 왼 귀 끝
		{-0.52, 0.58},   // 이마 (귀 사이 골)
		{-0.36, 0.80},   // 오른 귀 끝
		{-0.28, 0.45},   // 오른 뺨
		{-0.30, 0.20},   // 목으로 돌아와 고리 닫기
	};

	private static final double[][] BODY_TOP = {
		{0.05, 0.28},    // 등 앞
		{0.45, 0.30},    // 등
		{0.68, 0.15},    // 엉덩이 위 — 여기서 꼬리가 갈라진다
	};

	private static final double[][] TAIL = {
		{0.88, 0.35},    // 꼬리 중간
		{0.82, 0.68},    // 꼬리 끝 (위로 휨)
	};

	private static final double[][] BODY_BOTTOM = {
		{0.68, -0.18},   // 엉덩이 아래
		{0.25, -0.30},   // 배
		{-0.12, -0.22},  // 배 앞
		{-0.30, 0.05},   // 가슴 → 목 근처로 고리 닫기
	};

	/**
	 * 앉은 고양이 옆모습, 23점. 왼쪽을 보고 앉아 있고 꼬리가 바닥을 따라 뒤로 돌아 위로 휜다.
	 * 경로는 꼬리 끝에서 시작해 엉덩이·등·귀·코·가슴·앞발·배·뒷발 순으로 몸통 고리를 닫는다.
	 * 이 진단에서 90~100 후보는 이것 하나다 — catFull 은 성긴 스케치라 70~89 가 정직한 기대다.
	 */
	private static List<ArtworkPointRow> catBest() {
		double[][] xy = {
			{0.92, -0.40},   // 꼬리 끝 (위로 휨)
			{0.88, -0.75},   // 꼬리 중간
			{0.65, -0.92},   // 꼬리 밑동 (바닥)
			{0.35, -0.85},   // 뒷발
			{0.50, -0.70},   // 뒷다리 뒤
			{0.55, -0.35},   // 엉덩이
			{0.40, -0.05},   // 허리
			{0.15, 0.20},    // 등
			{-0.10, 0.40},   // 어깨·목
			{-0.22, 0.60},   // 뒤통수
			{-0.30, 0.90},   // 뒷귀 끝
			{-0.42, 0.66},   // 귀 사이 골
			{-0.50, 0.90},   // 앞귀 끝
			{-0.62, 0.62},   // 이마
			{-0.72, 0.45},   // 코
			{-0.75, 0.25},   // 턱
			{-0.62, 0.05},   // 가슴
			{-0.58, -0.40},  // 앞다리
			{-0.55, -0.85},  // 앞발 앞
			{-0.25, -0.85},  // 앞발 뒤
			{-0.05, -0.60},  // 배
			{0.10, -0.85},   // 뒷다리 앞
			{0.35, -0.85},   // 뒷발로 돌아와 몸통 고리 닫기
		};
		return toRows(xy);
	}

	/** catBest 에서 꼬리 3점(경로 앞머리)을 뗀 것. 뒷발에서 시작해 몸통 고리를 닫는다. */
	private static List<ArtworkPointRow> catBestNoTail() {
		List<ArtworkPointRow> full = catBest();
		double[][] xy = new double[full.size() - 3][];
		for (int i = 3; i < full.size(); i++) {
			xy[i - 3] = new double[] {full.get(i).getX(), full.get(i).getY()};
		}
		return toRows(xy);
	}

	/**
	 * catBest 의 부위를 그대로 두고 자리만 바꾼다 — 머리(경로 9~15번째)를 오른쪽 아래로, 꼬리(0~2)를 왼쪽 위로.
	 * 몸통은 제자리. 부위는 넷 다 있고 배치만 엉망이다.
	 */
	private static List<ArtworkPointRow> catBestScrambled() {
		List<ArtworkPointRow> full = catBest();
		double[][] xy = new double[full.size()][];
		for (int i = 0; i < full.size(); i++) {
			double x = full.get(i).getX();
			double y = full.get(i).getY();
			if (i <= 2) {              // 꼬리 → 왼쪽 위
				x -= 1.6;
				y += 1.2;
			} else if (i >= 9 && i <= 15) {   // 머리 → 오른쪽 아래
				x += 1.2;
				y -= 1.5;
			}
			xy[i] = new double[] {Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))};
		}
		return toRows(xy);
	}

	/** 네 부위 제자리이지만 18점 성긴 스케치라 꼬리가 왕복선이고 몸통이 각져 있다. 70~89 를 기대한다. */
	private static List<ArtworkPointRow> catFull() {
		return toRows(concat(HEAD, BODY_TOP, TAIL, BODY_BOTTOM));
	}

	/** 부위는 다 있지만 귀가 지나치게 크고 몸통이 짧다. 70~89 를 기대한다. */
	private static List<ArtworkPointRow> catAwkward() {
		double[][] head = {
			{-0.30, 0.10}, {-0.55, -0.05}, {-0.76, 0.05}, {-0.82, 0.30},
			{-0.85, 0.98},   // 왼 귀 — 머리보다 큰 귀
			{-0.52, 0.45},
			{-0.20, 0.98},   // 오른 귀
			{-0.26, 0.32}, {-0.30, 0.10},
		};
		double[][] body = {
			{-0.05, 0.15}, {0.15, 0.12},            // 짧은 등
			{0.30, 0.45}, {0.20, 0.75},             // 꼬리
			{0.15, -0.12}, {-0.10, -0.15}, {-0.30, -0.02},
		};
		return toRows(concat(head, body));
	}

	/** 꼬리 없음. 나머지는 catFull 과 같다. 50~69 를 기대한다. */
	private static List<ArtworkPointRow> catNoTail() {
		return toRows(concat(HEAD, BODY_TOP, BODY_BOTTOM));
	}

	/**
	 * 부위는 넷 다 있으나 자리가 뒤바뀌었다 — 머리가 오른쪽 아래, 몸통이 왼쪽 위, 꼬리가 왼쪽 아래.
	 * 앵커 방식이 부위 체크리스트 합산과 갈라지는 지점이다. 50 아래를 기대한다.
	 */
	private static List<ArtworkPointRow> catScrambled() {
		double[][] head = shift(HEAD, 1.05, -0.75);           // 오른쪽 아래로
		double[][] body = shift(concat(BODY_TOP, BODY_BOTTOM), -0.55, 0.45);   // 왼쪽 위로
		double[][] tail = {{-0.85, -0.55}, {-0.70, -0.90}};   // 왼쪽 아래, 아무 데도 안 붙음
		return toRows(concat(head, body, tail));
	}

	/** 머리 고리만. 10~29 를 기대한다. */
	private static List<ArtworkPointRow> catHeadOnly() {
		return toRows(HEAD);
	}

	private static List<ArtworkPointRow> line() {
		List<ArtworkPointRow> points = new ArrayList<>();
		for (int i = 0; i < 12; i++) {
			points.add(new ArtworkPointRow(i, 100 + i, -0.9 + i * 0.16, 0.0));
		}
		return points;
	}

	private static List<ArtworkPointRow> scatter() {
		return scatter(42);
	}

	/** 고정 시드 — 진단을 다시 돌려도 같은 그림이어야 점수를 비교할 수 있다. */
	private static List<ArtworkPointRow> scatter(long seed) {
		Random random = new Random(seed);
		List<ArtworkPointRow> points = new ArrayList<>();
		for (int i = 0; i < 12; i++) {
			points.add(new ArtworkPointRow(i, 300 + i, random.nextDouble() * 2 - 1, random.nextDouble() * 2 - 1));
		}
		return points;
	}

	private static double[][] concat(double[][]... parts) {
		List<double[]> all = new ArrayList<>();
		for (double[][] part : parts) {
			all.addAll(List.of(part));
		}
		return all.toArray(new double[0][]);
	}

	private static double[][] shift(double[][] xy, double dx, double dy) {
		double[][] out = new double[xy.length][];
		for (int i = 0; i < xy.length; i++) {
			out[i] = new double[] {xy[i][0] + dx, xy[i][1] + dy};
		}
		return out;
	}

	private static List<ArtworkPointRow> toRows(double[][] xy) {
		List<ArtworkPointRow> points = new ArrayList<>(xy.length);
		for (int i = 0; i < xy.length; i++) {
			points.add(new ArtworkPointRow(i, 400 + i, xy[i][0], xy[i][1]));
		}
		return points;
	}

	/** {@code .env} 한 줄씩 읽는다. 스프링을 띄우지 않으려는 것이라 파서는 최소한만 한다. */
	private static Map<String, String> readEnv() throws IOException {
		Map<String, String> env = new HashMap<>();
		if (!Files.exists(ENV_FILE)) {
			return env;
		}
		for (String line : Files.readAllLines(ENV_FILE, StandardCharsets.UTF_8)) {
			String trimmed = line.strip();
			if (trimmed.isEmpty() || trimmed.startsWith("#")) {
				continue;
			}
			int equals = trimmed.indexOf('=');
			if (equals > 0) {
				env.put(trimmed.substring(0, equals).strip(), trimmed.substring(equals + 1).strip());
			}
		}
		return env;
	}
}
