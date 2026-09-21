package com.ssafy.backend.taste.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.taste.reference.TasteReference;

class TasteStatisticsCalculatorTests {

    private final TasteStatisticsCalculator calculator = new TasteStatisticsCalculator();

    @Test
    void calculatesMedianIqrAndHistogramAgainstCatalogPercentiles() {
        List<double[]> coordinates = List.of(point(10), point(20), point(80), point(90));

        TasteAxisStatistics first = calculator.calculate(coordinates, reference()).get(0);

        assertThat(first.raw().median()).isEqualTo(50);
        assertThat(first.percentile().q1()).isEqualTo(17.5);
        assertThat(first.percentile().q3()).isEqualTo(82.5);
        assertThat(first.percentile().iqr()).isEqualTo(65);
        assertThat(first.histogram()).containsExactly(0, 1, 1, 0, 0, 0, 0, 0, 1, 1);
    }

    @Test
    void clampsOutsideCatalogRange() {
        TasteAxisStatistics first = calculator.calculate(List.of(point(-10), point(110)), reference()).get(0);

        assertThat(first.percentile().min()).isZero();
        assertThat(first.percentile().max()).isEqualTo(100);
    }

    @Test
    void rejectsWrongDimension() {
        assertThatThrownBy(() -> calculator.calculate(List.of(new double[15]), reference()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("16");
    }

    @Test
    void identicalCoordinates_haveZeroSpread() {
        TasteAxisStatistics first = calculator.calculate(
                List.of(point(40), point(40), point(40)), reference()).get(0);

        assertThat(first.raw().q1()).isEqualTo(40);
        assertThat(first.raw().q3()).isEqualTo(40);
        assertThat(first.percentile().iqr()).isZero();
    }

    @Test
    void rejectsNonFiniteCoordinate() {
        assertThatThrownBy(() -> calculator.calculate(List.of(point(Double.NaN)), reference()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("finite");
    }

    private static double[] point(double value) {
        double[] point = new double[16];
        java.util.Arrays.fill(point, value);
        return point;
    }

    private static TasteReference reference() {
        List<TasteReference.Axis> axes = IntStream.rangeClosed(1, 16)
                .mapToObj(pc -> new TasteReference.Axis(
                        pc, 0.01,
                        IntStream.rangeClosed(0, 100).mapToObj(i -> (double) i).toList(),
                        new TasteReference.Label("VERIFIED", "MEDIUM", "low", "high", "test")))
                .toList();
        return new TasteReference("taste-reference-v1", "test-v1", "v2.1-pca16", "labels-v1", 101,
                OffsetDateTime.parse("2026-09-21T00:00:00Z"),
                new TasteReference.Lineage("manifest", "a".repeat(64), "abcdef0", "config"), axes);
    }
}
