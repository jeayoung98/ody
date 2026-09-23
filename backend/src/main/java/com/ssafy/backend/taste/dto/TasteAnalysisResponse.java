package com.ssafy.backend.taste.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import com.ssafy.backend.taste.analysis.TasteAxisStatistics;
import com.ssafy.backend.taste.analysis.TasteFinding;

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

    /**
     * @param findings 문장의 근거가 된 축별 판정. {@code narratives} 와 {@code findingId} 로 1:1 대응한다.
     *                 화면이 태그(방향·세기)를 그리려면 문장이 아니라 이 값을 봐야 한다 [S15P21A405-634].
     */
    public record Report(
            String level,
            boolean aiGenerated,
            boolean fresh,
            String summary,
            List<Narrative> narratives,
            List<TasteFinding> findings,
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
