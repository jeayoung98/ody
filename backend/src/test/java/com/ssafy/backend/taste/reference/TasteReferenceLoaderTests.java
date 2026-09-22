package com.ssafy.backend.taste.reference;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.taste.TasteFixtures;

class TasteReferenceLoaderTests {

    @Test
    void validatesSixteenMonotonicAxes() {
        TasteReferenceValidator.validate(reference("taste-v1", axes()), "taste-v1");
    }

    @Test
    void testFixture_matchesProductionReferenceContract() {
        TasteReferenceValidator.validate(TasteFixtures.reference(), "taste-v1");
    }

    @Test
    void rejectsAnalysisVersionMismatch() {
        assertThatThrownBy(() -> TasteReferenceValidator.validate(
                reference("other", axes()), "taste-v1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("version");
    }

    @Test
    void rejectsNonMonotonicQuantiles() {
        List<TasteReference.Axis> invalid = axes();
        invalid.set(0, axis(1, List.of(0.0, 2.0, 1.0)));

        assertThatThrownBy(() -> TasteReferenceValidator.validate(
                reference("taste-v1", invalid), "taste-v1"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static TasteReference reference(String analysisVersion, List<TasteReference.Axis> axes) {
        return new TasteReference("taste-reference-v1", analysisVersion, 100,
                OffsetDateTime.parse("2026-09-21T00:00:00Z"),
                new TasteReference.Lineage("manifest", "a".repeat(64), "abcdef0", "config"), axes);
    }

    private static List<TasteReference.Axis> axes() {
        return IntStream.rangeClosed(1, 16)
                .mapToObj(pc -> axis(pc, IntStream.rangeClosed(0, 100).mapToObj(i -> (double) i).toList()))
                .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));
    }

    private static TasteReference.Axis axis(int pc, List<Double> quantiles) {
        return new TasteReference.Axis(pc, 0.01, quantiles,
                new TasteReference.Label("VERIFIED", "MEDIUM", "low", "high", "test"));
    }
}
