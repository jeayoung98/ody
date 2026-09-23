package com.ssafy.backend.artwork.template;

import java.util.List;
import java.util.Optional;

/**
 * 고양이 모양 템플릿 — pc1/pc2 평면에 놓을 점들 (S15P21A405-595).
 *
 * <p>좌표는 -1~1, y 는 위가 양수. 점은 <b>경로 순서</b>다 — 별자리는 곡을 순서대로 이으므로 이 순서가
 * 곧 플레이리스트의 곡 순서가 된다. 생성기가 각 점에 가장 가까운 곡을 고른다.
 *
 * <p>좌표는 채점 진단({@code GmsScoreProbe})에서 실제로 채점된 그림과 같다 — 앉은 옆모습이 few-shot
 * 기준 위에서 90점을 받았다(plan.md 변별력 진단 v6). 그 그림이 곧 이 템플릿이다.
 *
 * @param name   API 에서 쓰는 식별자. 소문자·하이픈
 * @param label  화면에 보일 이름
 * @param points 경로 순서의 점. 2~30개(배치 API 제약)
 */
public record CatTemplate(String name, String label, List<double[]> points) {

	/** 앉은 옆모습 23점. 왼쪽을 보고 앉아 꼬리가 바닥을 따라 뒤로 돌아 위로 휜다. */
	public static final CatTemplate SITTING = of("sitting", "앉은 고양이", new double[][] {
		{0.92, -0.40}, {0.88, -0.75}, {0.65, -0.92},              // 꼬리 끝 → 밑동
		{0.35, -0.85}, {0.50, -0.70}, {0.55, -0.35},              // 뒷발 → 엉덩이
		{0.40, -0.05}, {0.15, 0.20}, {-0.10, 0.40}, {-0.22, 0.60}, // 등 → 뒤통수
		{-0.30, 0.90}, {-0.42, 0.66}, {-0.50, 0.90},              // 귀 · 골 · 귀
		{-0.62, 0.62}, {-0.72, 0.45}, {-0.75, 0.25},              // 이마 → 코 → 턱
		{-0.62, 0.05}, {-0.58, -0.40}, {-0.55, -0.85},            // 가슴 → 앞발
		{-0.25, -0.85}, {-0.05, -0.60}, {0.10, -0.85}, {0.35, -0.85}, // 배 → 뒷발(고리 닫기)
	});

	/** 성긴 스케치 18점. 머리 고리 + 등 + 꼬리 가지 + 배. */
	public static final CatTemplate SKETCH = of("sketch", "스케치 고양이", new double[][] {
		{-0.30, 0.20}, {-0.55, 0.02}, {-0.76, 0.14}, {-0.80, 0.42},
		{-0.68, 0.80}, {-0.52, 0.58}, {-0.36, 0.80}, {-0.28, 0.45}, {-0.30, 0.20},
		{0.05, 0.28}, {0.45, 0.30}, {0.68, 0.15},
		{0.88, 0.35}, {0.82, 0.68},
		{0.68, -0.18}, {0.25, -0.30}, {-0.12, -0.22}, {-0.30, 0.05},
	});

	/** 엎드린 고양이 17점. 왼쪽 머리, 길게 누운 몸통, 오른쪽 끝에서 올라가는 꼬리. */
	public static final CatTemplate LOAF = of("loaf", "엎드린 고양이", new double[][] {
		{-0.85, 0.05}, {-0.90, 0.35}, {-0.80, 0.62},             // 턱 → 뺨 → 귀
		{-0.62, 0.42}, {-0.50, 0.62}, {-0.40, 0.30}, {-0.30, 0.05}, // 골 → 귀 → 목
		{0.00, 0.15}, {0.40, 0.15}, {0.75, 0.05},                 // 등
		{0.92, 0.28}, {0.85, 0.58},                               // 꼬리
		{0.70, -0.25}, {0.30, -0.30}, {-0.20, -0.30}, {-0.60, -0.25}, // 배
		{-0.85, 0.05},                                            // 턱으로 고리 닫기
	});

	public static final List<CatTemplate> ALL = List.of(SITTING, SKETCH, LOAF);

	public static Optional<CatTemplate> find(String name) {
		if (name == null) {
			return Optional.empty();
		}
		String key = name.strip().toLowerCase();
		return ALL.stream().filter(t -> t.name().equals(key)).findFirst();
	}

	private static CatTemplate of(String name, String label, double[][] xy) {
		return new CatTemplate(name, label, List.of(xy));
	}
}
