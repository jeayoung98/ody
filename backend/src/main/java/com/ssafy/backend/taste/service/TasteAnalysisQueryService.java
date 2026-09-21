package com.ssafy.backend.taste.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.TasteErrorCode;
import com.ssafy.backend.taste.analysis.TasteAxisStatistics;
import com.ssafy.backend.taste.analysis.TasteSnapshotHasher;
import com.ssafy.backend.taste.analysis.TasteStatisticsCalculator;
import com.ssafy.backend.taste.dto.TasteAnalysisResponse;
import com.ssafy.backend.taste.mapper.TasteAnalysisMapper;
import com.ssafy.backend.taste.mapper.TasteAnalysisRow;
import com.ssafy.backend.taste.music.TasteMusicMapper;
import com.ssafy.backend.taste.music.TasteMusicRow;
import com.ssafy.backend.taste.reference.TasteReference;
import com.ssafy.backend.taste.reference.TasteReferenceProvider;

import io.micrometer.core.instrument.MeterRegistry;

@Service
public class TasteAnalysisQueryService {

    static final String ANALYSIS_POLICY_VERSION = "taste-v1";

    private final TasteMusicMapper musicMapper;
    private final TasteReferenceProvider referenceProvider;
    private final TasteStatisticsCalculator calculator;
    private final TasteAnalysisMapper analysisMapper;
    private final TasteSnapshotHasher hasher;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final ZoneId zoneId;
    private final MeterRegistry meterRegistry;

    public TasteAnalysisQueryService(
            TasteMusicMapper musicMapper,
            TasteReferenceProvider referenceProvider,
            TasteStatisticsCalculator calculator,
            TasteAnalysisMapper analysisMapper,
            TasteSnapshotHasher hasher,
            Clock clock,
            @Value("${ody.taste.zone}") String zone,
            MeterRegistry meterRegistry) {
        this.musicMapper = musicMapper;
        this.referenceProvider = referenceProvider;
        this.calculator = calculator;
        this.analysisMapper = analysisMapper;
        this.hasher = hasher;
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.clock = clock;
        this.zoneId = ZoneId.of(zone);
        this.meterRegistry = meterRegistry;
    }

    @Transactional(readOnly = true)
    public TasteAnalysisResponse get(String email) {
        return snapshot(email).response();
    }

    @Transactional(readOnly = true)
    public AnalysisSnapshot snapshot(String email) {
        TasteReference reference = referenceProvider.current().orElseGet(() -> {
            meterRegistry.counter("ody.taste.query.outcomes", "outcome", "reference_unavailable").increment();
            throw new CustomException(TasteErrorCode.TASTE_REFERENCE_UNAVAILABLE);
        });
        List<TasteMusicRow> rows = musicMapper.findLikedMusic(email);
        List<Long> likedMusicIds = rows.stream().map(TasteMusicRow::getMusicId).toList();
        List<double[]> coordinates = new ArrayList<>();
        List<TasteAnalysisResponse.Point> points = new ArrayList<>();
        for (TasteMusicRow row : rows) {
            double[] values = row.coordinates();
            if (values == null) {
                continue;
            }
            coordinates.add(values);
            points.add(new TasteAnalysisResponse.Point(
                    row.getMusicId(), row.getTitle(), row.getArtist(),
                    Arrays.stream(values).boxed().toList()));
        }

        int valid = coordinates.size();
        int excluded = rows.size() - valid;
        List<TasteAxisStatistics> axes = calculator.calculate(coordinates, reference);
        String level = valid < 10 ? null : valid < 30 ? "INITIAL" : "STANDARD";
        String state = rows.isEmpty() ? "EMPTY" : valid < 10 ? "DISTRIBUTION_ONLY" : "READY";
        TasteAnalysisResponse current = new TasteAnalysisResponse(
                state,
                new TasteAnalysisResponse.Counts(
                        rows.size(), valid, excluded,
                        excluded == 0 ? Map.of() : Map.of("MISSING_OR_INVALID_LOCATION", excluded)),
                new TasteAnalysisResponse.Eligibility(valid >= 10, level, Math.max(0, 10 - valid)),
                new TasteAnalysisResponse.ReferenceVersions(
                        reference.bundleVersion(), reference.referenceVersion(),
                        reference.axisLabelVersion(), ANALYSIS_POLICY_VERSION),
                axes,
                List.copyOf(points),
                null,
                new TasteAnalysisResponse.Generation(
                        valid >= 10 ? "NOT_REQUESTED" : "INELIGIBLE",
                        false, false, false, null, null));
        TasteAnalysisResponse withLatestReport = attachLatestReport(email, current, likedMusicIds);
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), zoneId);
        TasteAnalysisRow pending = analysisMapper.findActivePending(email, now);
        if (pending == null) {
            return new AnalysisSnapshot(withLatestReport, likedMusicIds);
        }
        TasteAnalysisResponse inProgress = new TasteAnalysisResponse(
                "IN_PROGRESS",
                withLatestReport.counts(), withLatestReport.reportEligibility(), withLatestReport.reference(),
                withLatestReport.axes(), withLatestReport.points(), withLatestReport.report(),
                new TasteAnalysisResponse.Generation(
                        "IN_PROGRESS", false, withLatestReport.generation().dailyLimitUsedToday(),
                        false, null, pending.getLeaseExpiresAt()));
        return new AnalysisSnapshot(inProgress, likedMusicIds);
    }

    private TasteAnalysisResponse attachLatestReport(
            String email, TasteAnalysisResponse current, List<Long> likedMusicIds) {
        TasteAnalysisRow latest = analysisMapper.findLatestSuccess(email);
        if (latest == null) {
            return current;
        }
        String currentHash = hasher.hash(
                likedMusicIds, current.reference(), TasteAnalysisGenerationService.PROMPT_VERSION);
        boolean fresh = currentHash.equals(latest.getLikedSetHash());
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), zoneId);
        boolean usedToday = latest.getAnalysisDate().equals(now.toLocalDate());
        TasteAnalysisResponse.Report report = new TasteAnalysisResponse.Report(
                latest.getReportLevel(), true, fresh, latest.getSummary(),
                readNarratives(latest.getNarratives()),
                latest.getRequestedAt(), latest.getCompletedAt(), latest.getCompletedAt());
        TasteAnalysisResponse.Generation generation = new TasteAnalysisResponse.Generation(
                current.generation().status(), false, usedToday, false, null,
                usedToday ? now.toLocalDate().plusDays(1).atStartOfDay(zoneId).toOffsetDateTime() : null);
        return new TasteAnalysisResponse(
                fresh ? "FRESH" : "STALE",
                current.counts(), current.reportEligibility(), current.reference(),
                current.axes(), current.points(), report, generation);
    }

    public record AnalysisSnapshot(TasteAnalysisResponse response, List<Long> likedMusicIds) {
        public AnalysisSnapshot {
            likedMusicIds = List.copyOf(likedMusicIds);
        }
    }

    private List<TasteAnalysisResponse.Narrative> readNarratives(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("stored taste narratives are invalid", error);
        }
    }
}
