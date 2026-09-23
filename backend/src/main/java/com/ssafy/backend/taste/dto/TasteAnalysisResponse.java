package com.ssafy.backend.taste.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import com.ssafy.backend.taste.analysis.TasteAxisStatistics;

public record TasteAnalysisResponse(
        String state,
        Counts counts,
        Eligibility reportEligibility,
        String analysisVersion,
        List<TasteAxisStatistics> axes,
        List<Point> points,
        Report report,
        Generation generation) {

    public record Counts(int totalLiked, int valid, int excluded, Map<String, Integer> exclusions) {
    }

    public record Eligibility(boolean eligible, String level, int additionalLikesNeeded) {
    }

    public record Point(long musicId, String title, String artist, List<Double> coordinates) {
    }

    public record Report(
            String level,
            boolean aiGenerated,
            boolean fresh,
            String summary,
            List<Narrative> narratives,
            OffsetDateTime analyzedAt,
            OffsetDateTime generatedAt,
            OffsetDateTime lastRefreshedAt) {
    }

    public record Narrative(String findingId, String text, String evidence) {
    }

    public record Generation(
            String status,
            boolean generatedThisRequest,
            boolean dailyLimitUsedToday,
            boolean canRetry,
            String failureCode,
            OffsetDateTime nextAvailableAt) {
    }
}
