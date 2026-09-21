package com.ssafy.backend.taste.reference;

import java.util.HashSet;
import java.util.Set;

final class TasteReferenceValidator {

    private TasteReferenceValidator() {
    }

    static void validate(TasteReference reference, String expectedBundle) {
        if (!"taste-reference-v1".equals(reference.schemaVersion())) {
            throw new IllegalArgumentException("unsupported taste reference schema");
        }
        if (!expectedBundle.equals(reference.bundleVersion())) {
            throw new IllegalArgumentException("taste reference bundle mismatch");
        }
        if (reference.populationCount() < 1 || reference.axes() == null || reference.axes().size() != 16) {
            throw new IllegalArgumentException("taste reference must contain 16 axes");
        }

        Set<Integer> pcs = new HashSet<>();
        for (TasteReference.Axis axis : reference.axes()) {
            if (axis.pc() < 1 || axis.pc() > 16 || !pcs.add(axis.pc())) {
                throw new IllegalArgumentException("invalid or duplicate pc");
            }
            if (axis.quantiles() == null || axis.quantiles().size() != 101) {
                throw new IllegalArgumentException("each axis requires 101 quantiles");
            }
            double previous = Double.NEGATIVE_INFINITY;
            for (Double value : axis.quantiles()) {
                if (value == null || !Double.isFinite(value) || value < previous) {
                    throw new IllegalArgumentException("quantiles must be finite and monotonic");
                }
                previous = value;
            }
        }
    }
}
