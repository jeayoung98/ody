package com.ssafy.backend.taste.reference;

import java.time.OffsetDateTime;
import java.util.List;

public record TasteReference(
        String schemaVersion,
        String analysisVersion,
        long populationCount,
        OffsetDateTime generatedAt,
        Lineage lineage,
        List<Axis> axes) {

    public record Lineage(
            String sourceManifest,
            String sourceChecksum,
            String generatorCommit,
            String generatorConfig) {
    }

    public record Axis(
            int pc,
            double explainedVariance,
            List<Double> quantiles,
            Label label) {
    }

    public record Label(
            String status,
            String strength,
            String low,
            String high,
            String evidence) {

        public boolean usableForNarrative() {
            return "VERIFIED".equals(status)
                    && ("STRONG".equals(strength) || "MEDIUM".equals(strength));
        }
    }
}
