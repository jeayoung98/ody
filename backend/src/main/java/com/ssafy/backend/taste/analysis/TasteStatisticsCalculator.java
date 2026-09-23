package com.ssafy.backend.taste.analysis;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.springframework.stereotype.Component;

import com.ssafy.backend.taste.reference.TasteReference;

@Component
public class TasteStatisticsCalculator {

    public List<TasteAxisStatistics> calculate(List<double[]> coordinates, TasteReference reference) {
        if (coordinates.isEmpty()) {
            return List.of();
        }
        for (double[] coordinate : coordinates) {
            if (coordinate.length != 16) {
                throw new IllegalArgumentException("taste coordinate must have 16 values");
            }
        }

        List<TasteAxisStatistics> result = new ArrayList<>(16);
        List<TasteReference.Axis> axes = reference.axes().stream()
                .sorted(java.util.Comparator.comparingInt(TasteReference.Axis::pc))
                .toList();
        for (int index = 0; index < 16; index++) {
            final int axisIndex = index;
            double[] raw = coordinates.stream().mapToDouble(values -> values[axisIndex]).sorted().toArray();
            if (Arrays.stream(raw).anyMatch(value -> !Double.isFinite(value))) {
                throw new IllegalArgumentException("taste coordinate must be finite");
            }
            TasteReference.Axis axis = axes.get(index);
            double[] percentiles = Arrays.stream(raw)
                    .map(value -> toPopulationPercentile(value, axis.quantiles()))
                    .sorted()
                    .toArray();
            TasteAxisStatistics.Summary rawSummary = summary(raw);
            TasteAxisStatistics.Summary percentileSummary = summary(percentiles);
            result.add(new TasteAxisStatistics(
                    axis.pc(),
                    rawSummary,
                    new TasteAxisStatistics.PercentileSummary(
                            percentileSummary.min(), percentileSummary.q1(), percentileSummary.median(),
                            percentileSummary.q3(), percentileSummary.max(),
                            percentileSummary.q3() - percentileSummary.q1()),
                    histogram(percentiles),
                    axis.explainedVariance(),
                    axis.label()));
        }
        return List.copyOf(result);
    }

    static double toPopulationPercentile(double value, List<Double> cutPoints) {
        if (value <= cutPoints.get(0)) {
            return 0;
        }
        if (value >= cutPoints.get(100)) {
            return 100;
        }
        int low = 0;
        int high = 100;
        while (low + 1 < high) {
            int middle = (low + high) >>> 1;
            if (cutPoints.get(middle) <= value) {
                low = middle;
            } else {
                high = middle;
            }
        }
        double from = cutPoints.get(low);
        double to = cutPoints.get(high);
        if (to == from) {
            return high;
        }
        return low + (value - from) / (to - from);
    }

    private static TasteAxisStatistics.Summary summary(double[] sorted) {
        return new TasteAxisStatistics.Summary(
                sorted[0],
                quantile(sorted, 0.25),
                quantile(sorted, 0.5),
                quantile(sorted, 0.75),
                sorted[sorted.length - 1]);
    }

    private static double quantile(double[] sorted, double probability) {
        double position = probability * (sorted.length - 1);
        int lower = (int) Math.floor(position);
        int upper = (int) Math.ceil(position);
        if (lower == upper) {
            return sorted[lower];
        }
        return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
    }

    private static List<Integer> histogram(double[] percentiles) {
        int[] bins = new int[10];
        for (double percentile : percentiles) {
            bins[Math.min((int) (percentile / 10), 9)]++;
        }
        return Arrays.stream(bins).boxed().toList();
    }
}
