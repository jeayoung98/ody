package com.ssafy.backend.artwork.evaluation;

/**
 * 채점 기준 그림 1장 (few-shot).
 *
 * <p>2026-09-22 진단 v6: 말로 된 구간만 주면 엉망 배치와 난수를 못 가르던 모델이, 점수가 붙은
 * 기준 그림 4장을 먼저 보이자 둘을 갈랐다. 문구로는 안 됐던 것이다 (plan.md "변별력 진단").
 *
 * <p>기준 그림은 {@code artwork} 행({@code is_anchor = true}, 점수 고정)으로 저장되고 같은 렌더러로
 * 그려진다 — 채점 대상과 같은 화풍이어야 비교가 성립한다.
 *
 * @param pngBytes 렌더된 기준 그림
 * @param score    이 그림에 매겨 둔 점수. 모델에게 그대로 보여준다
 */
public record ArtworkAnchor(byte[] pngBytes, int score) {
}
