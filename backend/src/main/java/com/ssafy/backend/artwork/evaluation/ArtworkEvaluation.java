package com.ssafy.backend.artwork.evaluation;

/**
 * AI 채점 결과 1건.
 *
 * @param score   0~100 정수. 이 타입에 담긴 값은 이미 범위 검증을 통과한 것이다
 * @param comment 한국어 한 줄 평. 비어 있지 않다
 * @param model   실제로 점수를 준 모델 id. 어떤 모델이 매긴 점수인지 남긴다(헌법 VII)
 */
public record ArtworkEvaluation(int score, String comment, String model) {
}
