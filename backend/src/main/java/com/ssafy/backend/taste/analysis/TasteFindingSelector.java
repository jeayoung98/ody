package com.ssafy.backend.taste.analysis;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

/**
 * 축별 분포에서 리포트 근거가 될 finding 을 고른다.
 *
 * <p>임계값은 <b>표본 크기에 따라 달라진다</b>. 통계는 코퍼스 101분위로 변환한 백분위(0~100) 위에서
 * 재므로, 좋아요가 코퍼스 무작위 표본이면 백분위는 정의상 균등분포가 된다. 그 균등분포에서 우연히
 * 나오는 값이 곧 "취향이 없을 때의 잡음"이고, 아래 표는 그 잡음 분포의 분위수다
 * (BIAS·DIVERSE 는 상위 1.5%, CONSISTENT 는 하위 1.5%). 즉 축당 오탐률이 표본 크기와 무관하게 1.5% 로 고정된다.
 *
 * <p><b>1.5% 인 이유는 다중검정 보정이다.</b> 후보 축이 16개이므로 축당 1.5% 면 취향이 없는 사용자에게
 * 우연히 걸리는 축이 평균 0.24개다. 등급으로 5축만 쓰던 때의 5% x 5축 = 0.25 와 같은 수준을 유지한다.
 * 후보 축 수를 바꾸면 이 값도 같이 바꿔야 한다.
 *
 * <p>고정값(치우침 15 / 넓음 50 / 좁음 30)을 쓰면 표본이 작을수록 잡음이 커져서, 2026-09-22 실측 기준
 * 10곡 사용자는 취향이 전혀 없어도 16축 중 7개가 걸렸고 넓음은 좋아요가 늘수록 오히려 더 걸렸다.
 *
 * <p>이 숫자는 <b>코퍼스와 무관한 상수</b>다. 백분위 변환이 어떤 코퍼스든 균등분포로 보내기 때문에,
 * 기준 산출물(taste-reference)이 바뀌어도 다시 뽑을 필요가 없다. 2026-09-22 검증에서 운영 코퍼스
 * 28,065곡으로 만든 잡음 분포와 순수 균등분포가 전 구간 0.3 이내로 일치했다.
 */
@Component
public class TasteFindingSelector {

    /** 잡음 분포 분위수 표. 사이 값은 log(n) 선형보간한다. */
    private static final double[] SAMPLE_SIZES = {10, 15, 20, 30, 50, 100, 300};
    /** |중앙 백분위 - 50| 상위 1.5% — 이보다 크면 치우침이 잡음으로 설명되지 않는다 */
    private static final double[] BIAS_CUT = {31.4, 28.1, 24.4, 20.6, 16.5, 11.9, 7.0};
    /** IQR 상위 1.5% — 이보다 넓으면 무작위 표본보다도 넓다 */
    private static final double[] DIVERSE_CUT = {69.8, 68.3, 67.7, 65.3, 62.8, 59.7, 55.9};
    /** IQR 하위 1.5% — 이보다 좁으면 무작위 표본보다 뚜렷하게 모여 있다 */
    private static final double[] CONSISTENT_CUT = {14.8, 20.8, 24.0, 28.5, 33.5, 38.4, 43.4};

    public List<TasteFinding> select(List<TasteAxisStatistics> statistics, int sampleSize) {
        double biasCut = interpolate(BIAS_CUT, sampleSize);
        double diverseCut = interpolate(DIVERSE_CUT, sampleSize);
        double consistentCut = interpolate(CONSISTENT_CUT, sampleSize);

        record Scored(TasteFinding finding, double strength) {
        }

        List<Scored> candidates = new ArrayList<>();
        for (TasteAxisStatistics axis : statistics) {
            if (axis.label() == null || !axis.label().hasUsableWords()) {
                continue;
            }
            double median = axis.percentile().median();
            double iqr = axis.percentile().iqr();
            double bias = Math.abs(median - 50);
            if (iqr >= diverseCut) {
                candidates.add(new Scored(
                        finding(axis, "DIVERSE", "BOTH", iqr), strength(iqr, diverseCut, 100)));
            } else if (bias >= biasCut) {
                String type = iqr <= consistentCut ? "CONSISTENT_BIAS" : "BIAS";
                candidates.add(new Scored(
                        finding(axis, type, median < 50 ? "LOW" : "HIGH", bias),
                        strength(bias, biasCut, 50)));
            }
        }

        candidates.sort(Comparator
                .comparingDouble(Scored::strength).reversed()
                .thenComparing(scored -> scored.finding().pc()));
        if (candidates.isEmpty()) {
            return List.of(new TasteFinding(
                    "balanced", "BALANCED", null, "CENTER", 0,
                    "어느 축에서도 뚜렷한 편향이나 넓은 분포가 발견되지 않음",
                    "뚜렷한 한 방향보다 여러 특성을 고르게 듣는 경향"));
        }
        return candidates.stream().limit(3).map(Scored::finding).toList();
    }

    /**
     * 타입이 달라도 견줄 수 있는 세기. 잡음 컷을 넘은 정도를 그 축에서 갈 수 있는 끝까지의 비율로 잰다.
     * 컷에 겨우 걸치면 0, 이론상 최대면 1 이다. 치우침의 끝은 50(모든 곡이 한쪽 끝), 퍼짐의 끝은 100 이다.
     *
     * <p>이전에는 타입이 정렬 첫 키여서 겨우 걸친 CONSISTENT_BIAS 가 아주 넓은 DIVERSE 를 이겼다.
     * 사용자 눈에는 더 뚜렷한 특징이 뒤로 밀렸다.
     */
    private static double strength(double measured, double cut, double ceiling) {
        return cut >= ceiling ? 0 : (measured - cut) / (ceiling - cut);
    }

    /**
     * 표 바깥은 양 끝 값으로 고정한다.
     * ponytail: 300곡 초과도 300곡 값을 쓴다 — 조금 보수적일 뿐 오탐이 늘지 않는다.
     * 1,000곡대 사용자가 실제로 생기면 그때 표를 늘린다.
     */
    private static double interpolate(double[] cuts, int sampleSize) {
        double n = Math.max(sampleSize, 1);
        if (n <= SAMPLE_SIZES[0]) {
            return cuts[0];
        }
        int last = SAMPLE_SIZES.length - 1;
        if (n >= SAMPLE_SIZES[last]) {
            return cuts[last];
        }
        int index = 0;
        while (SAMPLE_SIZES[index + 1] < n) {
            index++;
        }
        double from = Math.log(SAMPLE_SIZES[index]);
        double to = Math.log(SAMPLE_SIZES[index + 1]);
        double ratio = (Math.log(n) - from) / (to - from);
        return cuts[index] + (cuts[index + 1] - cuts[index]) * ratio;
    }

    private static TasteFinding finding(
            TasteAxisStatistics axis, String type, String direction, double effectSize) {
        String phrase = "LOW".equals(direction) ? axis.label().low()
                : "HIGH".equals(direction) ? axis.label().high()
                : axis.label().low() + TasteFinding.PHRASE_SEPARATOR + axis.label().high();
        String id = "pc" + axis.pc() + "-" + type.toLowerCase(java.util.Locale.ROOT);
        String evidence = "PC%d 중앙 백분위 %.1f, IQR %.1f"
                .formatted(axis.pc(), axis.percentile().median(), axis.percentile().iqr());
        return new TasteFinding(id, type, axis.pc(), direction, effectSize, evidence, phrase);
    }

}
