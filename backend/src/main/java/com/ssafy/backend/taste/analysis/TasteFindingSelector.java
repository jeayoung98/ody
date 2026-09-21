package com.ssafy.backend.taste.analysis;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

@Component
public class TasteFindingSelector {

    private static final double BIAS_THRESHOLD = 15;
    private static final double CONSISTENT_IQR_MAX = 30;
    private static final double DIVERSE_IQR_MIN = 50;

    public List<TasteFinding> select(List<TasteAxisStatistics> statistics) {
        List<TasteFinding> candidates = new ArrayList<>();
        for (TasteAxisStatistics axis : statistics) {
            if (axis.label() == null || !axis.label().usableForNarrative()) {
                continue;
            }
            double median = axis.percentile().median();
            double iqr = axis.percentile().iqr();
            double bias = Math.abs(median - 50);
            if (iqr >= DIVERSE_IQR_MIN) {
                candidates.add(finding(axis, "DIVERSE", "BOTH", iqr));
            } else if (bias >= BIAS_THRESHOLD) {
                String type = iqr <= CONSISTENT_IQR_MAX ? "CONSISTENT_BIAS" : "BIAS";
                candidates.add(finding(axis, type, median < 50 ? "LOW" : "HIGH", bias));
            }
        }

        candidates.sort(Comparator
                .comparingInt((TasteFinding finding) -> priority(finding.type()))
                .thenComparing(TasteFinding::effectSize, Comparator.reverseOrder())
                .thenComparing(TasteFinding::pc));
        if (candidates.isEmpty()) {
            return List.of(new TasteFinding(
                    "balanced", "BALANCED", null, "CENTER", 0,
                    "검증된 축에서 뚜렷한 편향이나 넓은 분포가 발견되지 않음",
                    "뚜렷한 한 방향보다 여러 특성을 고르게 듣는 경향"));
        }
        return List.copyOf(candidates.subList(0, Math.min(3, candidates.size())));
    }

    private static TasteFinding finding(
            TasteAxisStatistics axis, String type, String direction, double effectSize) {
        String phrase = "LOW".equals(direction) ? axis.label().low()
                : "HIGH".equals(direction) ? axis.label().high()
                : axis.label().low() + "부터 " + axis.label().high();
        String id = "pc" + axis.pc() + "-" + type.toLowerCase(java.util.Locale.ROOT);
        String evidence = "PC%d 중앙 백분위 %.1f, IQR %.1f"
                .formatted(axis.pc(), axis.percentile().median(), axis.percentile().iqr());
        return new TasteFinding(id, type, axis.pc(), direction, effectSize, evidence, phrase);
    }

    private static int priority(String type) {
        return switch (type) {
            case "CONSISTENT_BIAS" -> 0;
            case "BIAS" -> 1;
            case "DIVERSE" -> 2;
            default -> 3;
        };
    }
}
