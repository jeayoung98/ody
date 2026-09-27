package com.ssafy.backend.artwork;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.artwork.service.ShapeScore;
import com.ssafy.backend.artwork.service.ShapeScore.Quality;

/**
 * 모양 일치도 (S15P21A405-598, specs/010 research R2·R3).
 * 이동·회전·균일 배율에 불변이고, 반사·순서 바꿈·잡음에는 점수가 떨어져야 한다.
 */
class ShapeScoreTests {

	static List<List<double[]>> shapes() {
		return List.of(
				pts(0, 0, 1, 0, 0.5, 0.9),                                           // 삼각형
				pts(0, 0, 1, 0, 1, 1, 0, 1),                                         // 사각형
				star(),                                                              // 별 10점
				pts(0, 0, 1, 1, 2, 0, 3, 1, 4, 0, 5, 1));                            // 지그재그
	}

	@ParameterizedTest
	@MethodSource("shapes")
	void identical_is100(List<double[]> shape) {
		assertThat(ShapeScore.score(shape, shape)).isEqualTo(100);
	}

	@ParameterizedTest
	@MethodSource("shapes")
	void invariantToTranslationRotationUniformScale(List<double[]> shape) {
		for (double deg : new double[] {17, 90, 200}) {
			for (double scale : new double[] {0.5, 2}) {
				List<double[]> moved = transform(shape, Math.toRadians(deg), scale, 3.5, -7);
				assertThat(ShapeScore.score(shape, moved))
						.as("회전 %.0f° 배율 %.1f", deg, scale)
						.isGreaterThanOrEqualTo(99);
			}
		}
	}

	@Test
	void mirrorImage_isDifferentShape() {
		// 비대칭 도형 — 대칭 도형의 반사는 회전으로 되돌릴 수 있어 같은 모양이 된다.
		List<double[]> shape = pts(0, 0, 1, 0, 1, 2, 3, 3, 2, 5);
		List<double[]> mirrored = shape.stream().map(p -> new double[] {-p[0], p[1]}).toList();

		assertThat(ShapeScore.score(shape, mirrored)).isLessThanOrEqualTo(ShapeScore.score(shape, shape) - 20);
	}

	@Test
	void reorderedPoints_scoreDrops() {
		List<double[]> shape = pts(0, 0, 1, 1, 2, 0, 3, 1, 4, 0, 5, 1);
		List<double[]> reordered = new ArrayList<>(shape);
		Collections.swap(reordered, 0, 3);
		Collections.swap(reordered, 1, 4);

		assertThat(ShapeScore.score(shape, reordered)).isLessThan(90);
	}

	@ParameterizedTest
	@MethodSource("shapes")
	void noiseLevel_mapsToQuality(List<double[]> shape) {
		// 잡음 σ 는 도형의 RMS 반지름 대비. 0.03 → d≈0.04, 0.15 → d≈0.21, 0.5 → d≈0.7
		assertThat(ShapeScore.quality(ShapeScore.score(shape, noisy(shape, 0.03)))).isEqualTo(Quality.HIGH);
		assertThat(ShapeScore.quality(ShapeScore.score(shape, noisy(shape, 0.15)))).isEqualTo(Quality.MEDIUM);
		assertThat(ShapeScore.quality(ShapeScore.score(shape, noisy(shape, 0.5)))).isEqualTo(Quality.LOW);
	}

	@Test
	void qualityBoundaries() {
		assertThat(ShapeScore.quality(100)).isEqualTo(Quality.HIGH);
		assertThat(ShapeScore.quality(90)).isEqualTo(Quality.HIGH);
		assertThat(ShapeScore.quality(89)).isEqualTo(Quality.MEDIUM);
		assertThat(ShapeScore.quality(70)).isEqualTo(Quality.MEDIUM);
		assertThat(ShapeScore.quality(69)).isEqualTo(Quality.LOW);
		assertThat(ShapeScore.quality(0)).isEqualTo(Quality.LOW);
	}

	@Test
	void rejectsCollapsedOrMismatched() {
		List<double[]> collapsed = pts(1, 1, 1, 1, 1, 1);
		assertThatThrownBy(() -> ShapeScore.score(collapsed, pts(0, 0, 1, 0, 0, 1)))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> ShapeScore.score(pts(0, 0, 1, 0), pts(0, 0, 1, 0, 0, 1)))
				.isInstanceOf(IllegalArgumentException.class);
	}

	// ---------------- helpers ----------------

	private static List<double[]> pts(double... xy) {
		List<double[]> out = new ArrayList<>();
		for (int i = 0; i < xy.length; i += 2) {
			out.add(new double[] {xy[i], xy[i + 1]});
		}
		return out;
	}

	private static List<double[]> star() {
		List<double[]> out = new ArrayList<>();
		for (int i = 0; i < 10; i++) {
			double r = i % 2 == 0 ? 1 : 0.4;
			double a = Math.PI / 2 + i * Math.PI / 5;
			out.add(new double[] {r * Math.cos(a), r * Math.sin(a)});
		}
		return out;
	}

	private static List<double[]> transform(List<double[]> shape, double rad, double scale, double dx, double dy) {
		double c = Math.cos(rad);
		double s = Math.sin(rad);
		return shape.stream()
				.map(p -> new double[] {scale * (c * p[0] - s * p[1]) + dx, scale * (s * p[0] + c * p[1]) + dy})
				.toList();
	}

	private static List<double[]> noisy(List<double[]> shape, double sigma) {
		double mx = shape.stream().mapToDouble(p -> p[0]).average().orElse(0);
		double my = shape.stream().mapToDouble(p -> p[1]).average().orElse(0);
		double rms = Math.sqrt(shape.stream()
				.mapToDouble(p -> (p[0] - mx) * (p[0] - mx) + (p[1] - my) * (p[1] - my))
				.average().orElse(0));
		Random random = new Random(0);
		return shape.stream()
				.map(p -> new double[] {
						p[0] + random.nextGaussian() * sigma * rms,
						p[1] + random.nextGaussian() * sigma * rms})
				.toList();
	}
}
