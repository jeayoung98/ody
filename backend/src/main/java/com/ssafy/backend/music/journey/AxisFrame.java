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
	 * 역 수 (D3, 핸드오프 §4.2). <b>먼 곡을 거절하지 않고 역만 늘린다.</b>
	 *
	 * <pre>
	 * L &lt;= farDist  ->  10
	 * L &gt;  farDist  ->  clamp(round(10 + (L − farDist)), 10, 20)
	 * </pre>
	 *
	 * @param farDist 먼 여정 기준 거리. 설정에서 온다({@code ServingRules.farEndpointDist}, 기본 10.7)
	 */
	public int stationCount(double farDist) {
		if (length <= farDist) {
			return 10;
		}
		// Math.clamp 는 Java 21 부터다. 이 프로젝트는 17 이라 직접 자른다.
		long n = Math.round(10 + (length - farDist));
		return (int) Math.min(20, Math.max(10, n));
	}

	/** 먼 여정인가 ({@code L > farDist}). 역 수를 늘리는 기준이며 응답에는 싣지 않는다(FR-023). */
	public boolean far(double farDist) {
		return length > farDist;
	}
}
