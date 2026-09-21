package com.ssafy.backend.taste.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.taste.reference.TasteReference;

class TasteFindingSelectorTests {

    private final TasteFindingSelector selector = new TasteFindingSelector();

    @Test
    void narrowHighDistribution_isConsistentBias() {
        List<TasteFinding> findings = selector.select(List.of(axis(1, 80, 20, "VERIFIED", "STRONG")));

        assertThat(findings.get(0).type()).isEqualTo("CONSISTENT_BIAS");
        assertThat(findings.get(0).direction()).isEqualTo("HIGH");
    }

    @Test
    void broadCenteredDistribution_isDiverseNotCenterPreference() {
        List<TasteFinding> findings = selector.select(List.of(axis(1, 50, 70, "VERIFIED", "MEDIUM")));

        assertThat(findings.get(0).type()).isEqualTo("DIVERSE");
        assertThat(findings.get(0).direction()).isEqualTo("BOTH");
    }

    @Test
    void unverifiedAxis_isNotNarrated() {
        List<TasteFinding> findings = selector.select(List.of(axis(1, 90, 10, "UNVERIFIED", "STRONG")));

        assertThat(findings).singleElement().extracting(TasteFinding::type).isEqualTo("BALANCED");
    }

    @Test
    void moderatelySpreadHighDistribution_isBias() {
        List<TasteFinding> findings = selector.select(List.of(axis(1, 75, 40, "VERIFIED", "MEDIUM")));

        assertThat(findings.get(0).type()).isEqualTo("BIAS");
        assertThat(findings.get(0).direction()).isEqualTo("HIGH");
    }

    @Test
    void separatedLowAndHighPeaks_areReportedAsDiverse() {
        TasteAxisStatistics bimodal = axis(
                1, 50, 60, "VERIFIED", "STRONG",
                List.of(0, 5, 0, 0, 0, 0, 0, 0, 5, 0));

        assertThat(selector.select(List.of(bimodal)).get(0).type()).isEqualTo("DIVERSE");
    }

    @Test
    void noMaterialSignal_returnsBalanced() {
        List<TasteFinding> findings = selector.select(List.of(axis(1, 50, 20, "VERIFIED", "STRONG")));

        assertThat(findings).singleElement().extracting(TasteFinding::type).isEqualTo("BALANCED");
    }

    @Test
    void findings_areStableAndLimitedToThree() {
        List<TasteFinding> findings = selector.select(List.of(
                axis(4, 80, 20, "VERIFIED", "STRONG"),
                axis(2, 80, 20, "VERIFIED", "STRONG"),
                axis(3, 75, 20, "VERIFIED", "STRONG"),
                axis(1, 50, 70, "VERIFIED", "STRONG")));

        assertThat(findings).extracting(TasteFinding::pc).containsExactly(2, 4, 3);
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
                new TasteReference.Label(status, strength, "잔잔한", "강렬한", "test"));
    }
}
