package com.ssafy.backend.taste.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class TasteSnapshotHasherTests {

    private final TasteSnapshotHasher hasher = new TasteSnapshotHasher();
    private static final String VERSION = "taste-v1";

    @Test
    void orderDoesNotChangeHash() {
        assertThat(hasher.hash(List.of(3L, 1L, 2L), VERSION))
                .isEqualTo(hasher.hash(List.of(1L, 2L, 3L), VERSION));
    }

    @Test
    void dataOrVersionChangeChangesHash() {
        String original = hasher.hash(List.of(1L, 2L), VERSION);

        assertThat(hasher.hash(List.of(1L, 3L), VERSION)).isNotEqualTo(original);
        assertThat(hasher.hash(List.of(1L, 2L), "taste-v2")).isNotEqualTo(original);
    }
}
