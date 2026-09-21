package com.ssafy.backend.taste.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.taste.dto.TasteAnalysisResponse;

class TasteSnapshotHasherTests {

    private final TasteSnapshotHasher hasher = new TasteSnapshotHasher();
    private final TasteAnalysisResponse.ReferenceVersions versions =
            new TasteAnalysisResponse.ReferenceVersions("bundle", "reference", "labels", "taste-v1");

    @Test
    void orderDoesNotChangeHash() {
        assertThat(hasher.hash(List.of(3L, 1L, 2L), versions, "prompt-v1"))
                .isEqualTo(hasher.hash(List.of(1L, 2L, 3L), versions, "prompt-v1"));
    }

    @Test
    void dataOrVersionChangeChangesHash() {
        String original = hasher.hash(List.of(1L, 2L), versions, "prompt-v1");

        assertThat(hasher.hash(List.of(1L, 3L), versions, "prompt-v1")).isNotEqualTo(original);
        assertThat(hasher.hash(List.of(1L, 2L), versions, "prompt-v2")).isNotEqualTo(original);
    }
}
