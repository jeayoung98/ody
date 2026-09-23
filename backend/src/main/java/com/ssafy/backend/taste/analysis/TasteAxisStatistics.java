package com.ssafy.backend.taste.analysis;

import java.util.List;

import com.ssafy.backend.taste.reference.TasteReference;

public record TasteAxisStatistics(
        int pc,
        Summary raw,
        PercentileSummary percentile,
        List<Integer> histogram,
        double explainedVariance,
        TasteReference.Label label) {

    public record Summary(double min, double q1, double median, double q3, double max) {
    }

    public record PercentileSummary(
            double min, double q1, double median, double q3, double max, double iqr) {
    }
}
