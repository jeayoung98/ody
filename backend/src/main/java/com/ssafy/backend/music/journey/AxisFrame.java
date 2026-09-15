package com.ssafy.backend.music.journey;

/**
 * A→B 축 좌표계 (핸드오프 §4.1, T053).
 *
 * <p>곡 {@code x} 를 두 값으로 본다.
 *
 * <pre>
 * u = (B − A) / |B − A|
 * 진행도 p = ((x − A) · u) / |B − A|     A 에서 0, B 에서 1
 * 축 이탈 r = ‖(x − A) − p·(B − A)‖       축에서 옆으로 벗어난 거리
 * </pre>
 *
 * <p>저장소를 모른다 — 좌표만 받아 계산한다. 그래서 합성 좌표로 실 DB 없이 검증된다(FR-019).
 *
 * <p><b>r 을 {@code ‖x−A‖² − (p·L)²} 로 구하지 않는다.</b> 두 큰 수의 차라 축 위에 있는 곡의 r 이
 * 0 대신 0.011 로 나온다(참조 구현이 밟은 자리). 수직 성분을 직접 만들어 노름을 잰다.
 */
public final class AxisFrame {

	private final float[] a;
	private final float[] u;
	/** 끝점 거리 {@code L = ‖B − A‖}. 0 이면 축이 성립하지 않는다. */
	private final double length;

	private AxisFrame(float[] a, float[] u, double length) {
		this.a = a;
		this.u = u;
		this.length = length;
	}

	/**
	 * 출발·도착 좌표로 축을 만든다.
	 *
	 * @throws IllegalArgumentException 차원이 다르면
	 */
	public static AxisFrame of(float[] start, float[] end) {
		if (start.length != end.length) {
			throw new IllegalArgumentException(
					"좌표 차원이 다르다: %d vs %d".formatted(start.length, end.length));
		}
		double sum = 0.0;
		float[] dir = new float[start.length];
		for (int i = 0; i < start.length; i++) {
			dir[i] = end[i] - start[i];
			sum += (double) dir[i] * dir[i];
		}
		double len = Math.sqrt(sum);
		if (len > 0) {
			for (int i = 0; i < dir.length; i++) {
				dir[i] = (float) (dir[i] / len);
			}
		}
		return new AxisFrame(start, dir, len);
	}

	/** 출발곡 좌표 A. DP 의 첫 전이가 여기서 출발한다. 복사본을 준다 — 축이 바뀌면 안 된다. */
	public float[] layerStart() {
		return a.clone();
	}

	/** 끝점 거리 {@code L}. */
	public double length() {
		return length;
	}

	/**
	 * 축이 성립하지 않는가. 서로 다른 곡인데 좌표가 같으면 참이다 —
	 * 통로를 만들 수 없으므로 호출자가 2곡 경로로 끊는다(FR-012).
	 */
	public boolean degenerate() {
		return length == 0.0;
	}

	/** 진행도 {@code p}. A 에서 0, B 에서 1. */
	public double progress(float[] x) {
		if (degenerate()) {
			return 0.0;
		}
		double proj = 0.0;
		for (int i = 0; i < x.length; i++) {
			proj += (double) (x[i] - a[i]) * u[i];
		}
		return proj / length;
	}

	/** 축 이탈 {@code r}. 축까지의 수직 거리. */
	public double offAxis(float[] x) {
		if (degenerate()) {
			double sum = 0.0;
			for (int i = 0; i < x.length; i++) {
				double d = x[i] - a[i];
				sum += d * d;
			}
			return Math.sqrt(sum);
		}
		double proj = 0.0;
		for (int i = 0; i < x.length; i++) {
			proj += (double) (x[i] - a[i]) * u[i];
		}
		double sum = 0.0;
		for (int i = 0; i < x.length; i++) {
			double perp = (x[i] - a[i]) - proj * u[i];
			sum += perp * perp;
		}
		return Math.sqrt(sum);
	}

	/**
	 * 층 {@code k} 의 기준 지점 {@code c_k = A + t_k·(B − A)}, {@code t_k = k/(n+1)} (핸드오프 §4.3).
	 *
	 * <p>{@code ‖x − c_k‖² = L²·(p − t_k)² + r²} 이므로 <b>{@code c_k} 최근접이 곧 그 층의 후보</b>다.
	 * 660만 곡 통로 스캔 대신 이 지점으로 근사 최근접을 질의한다.
	 *
	 * @param k 1..n
	 * @param n 중간 정거장 수
	 */
	public float[] layerPoint(int k, int n) {
		double t = (double) k / (n + 1);
		float[] c = new float[a.length];
		for (int i = 0; i < a.length; i++) {
			c[i] = (float) (a[i] + t * u[i] * length);
		}
		return c;
	}

	/**
	 * 역 수. <b>끝점 거리에 비례한다</b> (007, S15P21A405-286).
	 *
	 * <pre>
	 * n = clamp(floor(L / spacing) - 1, 0, cap)
	 * </pre>
	 *
	 * <p><b>2026-09-13 실측으로 D3 의 "하한 10 · 기울기 1:1 · 상한 20" 을 대체했다.</b> 그 세 숫자는
	 * 2026-09-07 에 측정 없이 정해졌고 근거가 기록돼 있지 않았다. 하한 10 때문에 끝점 거리 3.2 인
	 * 쌍에도 역 11칸을 나눠, 축 방향 한 칸이 <b>0.29</b> 인데 그 지점 최근접 곡은 2.3 떨어져 있었다 —
	 * 한 걸음의 대부분이 앞이 아니라 옆으로 갔고 경로가 직선의 <b>8.6배</b>를 돌았다.
	 *
	 * <p>{@code spacing} 은 <b>코퍼스 최근접 반경</b>이다. 축 위 임의 지점 60곳에서 실제 최근접 곡까지의
	 * 거리를 재 <b>p50 2.272 · p90 2.684 · max 3.168</b> 를 얻었고 기본값 2.5 는 그 p60~70 이다.
	 * 이보다 잘게 나누면 이웃한 두 역이 같은 동네에서 뽑혀 진행이 되지 않는다(FR-002).
	 *
	 * <p><b>이 값은 좌표계 {@code v2.1-pca16} 에 귀속된다</b>(FR-006). 번들을 바꾸면 거리 눈금이
	 * 통째로 달라지므로 다시 재야 한다. 설정 키는 {@code ody.journey.station-spacing} 이다.
	 *
	 * <p><b>하한은 0 이다</b>(FR-004). 끝점이 {@code spacing} 보다 가까우면 중간에 넣을 자리가 없어
	 * 출발·도착 2곡만 반환한다 — 오류가 아니라 정상 응답이다. 층 질의도 0회 나간다.
	 *
	 * <p>{@code farDist} 를 더 이상 받지 않는다. {@link #far(double)} 는 남아 있고 관측 로그가 쓴다.
	 *
	 * @param spacing 이웃 역 사이 축 방향 간격의 하한. 0 보다 커야 한다
	 * @param cap     역 수 상한. 음수일 수 없다. 운영값 18 (출발·도착 포함 20곡)
	 */
	public int stationCount(double spacing, int cap) {
		if (spacing <= 0) {
			throw new IllegalArgumentException("spacing 은 0 보다 커야 한다: " + spacing);
		}
		if (cap < 0) {
			throw new IllegalArgumentException("cap 은 음수일 수 없다: " + cap);
		}
		// Math.clamp 는 Java 21 부터다. 이 프로젝트는 17 이라 직접 자른다.
		int n = (int) Math.floor(length / spacing) - 1;
		return Math.min(cap, Math.max(0, n));
	}

	/** 먼 여정인가 ({@code L > farDist}). 관측 로그에만 쓰고 응답에는 싣지 않는다(FR-023). 역 수와는 무관하다(007). */
	public boolean far(double farDist) {
		return length > farDist;
	}
}
