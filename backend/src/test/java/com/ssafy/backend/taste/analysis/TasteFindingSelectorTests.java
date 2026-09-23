package com.ssafy.backend.taste.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.taste.reference.TasteReference;

class TasteFindingSelectorTests {

    private static final int N = 30;  // 30곡 기준: 치우침 20.6 / 넓음 65.3 / 좁음 28.5

    private final TasteFindingSelector selector = new TasteFindingSelector();

    @Test
    void narrowHighDistribution_isConsistentBias() {
        List<TasteFinding> findings = selector.select(List.of(axis(1, 80, 20, "VERIFIED", "STRONG")), N);

        assertThat(findings.get(0).type()).isEqualTo("CONSISTENT_BIAS");
        assertThat(findings.get(0).direction()).isEqualTo("HIGH");
    }

    @Test
    void broadCenteredDistribution_isDiverseNotCenterPreference() {
        List<TasteFinding> findings = selector.select(List.of(axis(1, 50, 70, "VERIFIED", "MEDIUM")), N);

        assertThat(findings.get(0).type()).isEqualTo("DIVERSE");
        assertThat(findings.get(0).direction()).isEqualTo("BOTH");
    }

    @Test
    void unverifiedAxis_isStillNarrated() {
        // 등급·검증 상태로 거르지 않는다. 뜰지 말지는 그 사용자의 분포가 정한다.
        List<TasteFinding> findings = selector.select(List.of(axis(1, 90, 10, "UNVERIFIED", "WEAK")), N);

        assertThat(findings.get(0).type()).isEqualTo("CONSISTENT_BIAS");
    }

    @Test
    void axisWithoutWords_isNotNarrated() {
        TasteAxisStatistics unlabeled = new TasteAxisStatistics(
                1,
                new TasteAxisStatistics.Summary(0, 1, 2, 3, 4),
                new TasteAxisStatistics.PercentileSummary(0, 84, 90, 96, 100, 12),
                List.of(0, 0, 0, 0, 0, 0, 0, 0, 0, 1),
                0.1,
                new TasteReference.Label("UNLABELED", "NONE", null, null, null, "test"));

        assertThat(selector.select(List.of(unlabeled), N))
                .singleElement().extracting(TasteFinding::type).isEqualTo("BALANCED");
    }

    @Test
    void moderatelySpreadHighDistribution_isBias() {
        List<TasteFinding> findings = selector.select(List.of(axis(1, 75, 40, "VERIFIED", "MEDIUM")), N);

        assertThat(findings.get(0).type()).isEqualTo("BIAS");
        assertThat(findings.get(0).direction()).isEqualTo("HIGH");
    }

    @Test
    void separatedLowAndHighPeaks_areReportedAsDiverse() {
        TasteAxisStatistics bimodal = axis(
                1, 50, 70, "VERIFIED", "STRONG",
                List.of(0, 5, 0, 0, 0, 0, 0, 0, 5, 0));

        assertThat(selector.select(List.of(bimodal), N).get(0).type()).isEqualTo("DIVERSE");
    }

    @Test
    void noMaterialSignal_returnsBalanced() {
        List<TasteFinding> findings = selector.select(List.of(axis(1, 50, 20, "VERIFIED", "STRONG")), N);

        assertThat(findings).singleElement().extracting(TasteFinding::type).isEqualTo("BALANCED");
    }

    @Test
    void findings_areStableAndLimitedToThree() {
        List<TasteFinding> findings = selector.select(List.of(
                axis(4, 80, 20, "VERIFIED", "STRONG"),
                axis(2, 80, 20, "VERIFIED", "STRONG"),
                axis(3, 75, 20, "VERIFIED", "STRONG"),
                axis(1, 50, 70, "VERIFIED", "STRONG")), N);

        assertThat(findings).extracting(TasteFinding::pc).containsExactly(2, 4, 3);
    }

    @Test
    void sameDistribution_isNotCalledBiasedWhenSampleIsTooSmallToTell() {
        // 중앙 백분위 70(치우침 20)은 10곡에서는 잡음으로 설명되고(임계 26.5) 100곡에서는 아니다(임계 9.7).
        TasteAxisStatistics axis = axis(1, 70, 45, "VERIFIED", "STRONG");

        assertThat(selector.select(List.of(axis), 10))
                .singleElement().extracting(TasteFinding::type).isEqualTo("BALANCED");
        assertThat(selector.select(List.of(axis), 100).get(0).type()).isEqualTo("BIAS");
    }

    @Test
    void randomlySpreadDistribution_isNotCalledDiverse() {
        // 무작위 표본의 IQR 중앙값은 50 근처다. 그 정도 폭은 "폭넓게 듣는다"가 아니다.
        TasteAxisStatistics axis = axis(1, 50, 50, "VERIFIED", "STRONG");

        assertThat(selector.select(List.of(axis), 30))
                .singleElement().extracting(TasteFinding::type).isEqualTo("BALANCED");
    }

    @Test
    void strongerAxisComesFirstEvenWhenItsTypeUsedToRankLower() {
        // 30곡 기준 치우침 임계 20.6 / 넓음 임계 65.3.
        // pc1 은 겨우 걸친 CONSISTENT_BIAS(치우침 21.5), pc2 는 한참 넘긴 DIVERSE(IQR 90).
        // 예전에는 타입이 정렬 첫 키여서 pc1 이 앞섰다.
        List<TasteFinding> findings = selector.select(List.of(
                axis(1, 71.5, 20, "VERIFIED", "STRONG"),
                axis(2, 50, 90, "VERIFIED", "STRONG")), N);

        assertThat(findings).extracting(TasteFinding::pc).containsExactly(2, 1);
        assertThat(findings.get(0).type()).isEqualTo("DIVERSE");
    }

    /** PC10~14 는 라벨이 전문 용어라 요약에서 뺐다. 분포가 아무리 뚜렷해도 문장이 되지 않는다. */
    @Test
    void excludedAxis_isNotNarratedEvenWhenStronglyBiased() {
        TasteAxisStatistics excluded = axis(12, 95, 8, "VERIFIED", "STRONG");

        assertThat(selector.select(List.of(excluded), N))
                .singleElement().extracting(TasteFinding::type).isEqualTo("BALANCED");
    }

    @Test
    void candidateAxis_isStillNarrated() {
        TasteAxisStatistics candidate = axis(9, 95, 8, "VERIFIED", "STRONG");

        assertThat(selector.select(List.of(candidate), N).get(0).pc()).isEqualTo(9);
    }

    private static TasteAxisStatistics axis(
            int pc, double median, double iqr, String status, String strength) {
        return axis(pc, median, iqr, status, strength, List.of(0, 0, 0, 0, 0, 0, 0, 0, 0, 1));
    }

    private static TasteAxisStatistics axis(
            int pc, double median, double iqr, String status, String strength,
            List<Integer> histogram) {
        double q1 = median - iqr / 2;
        double q3 = median + iqr / 2;
        return new TasteAxisStatistics(
                pc,
                new TasteAxisStatistics.Summary(0, 1, 2, 3, 4),
                new TasteAxisStatistics.PercentileSummary(0, q1, median, q3, 100, iqr),
                histogram,
                0.1,
                new TasteReference.Label(status, strength, "세기", "잔잔한", "강렬한", "test"));
    }
}
