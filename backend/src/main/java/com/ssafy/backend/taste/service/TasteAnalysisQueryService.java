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
import com.ssafy.backend.taste.analysis.TasteFinding;
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
                reference.analysisVersion(),
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
                withLatestReport.counts(), withLatestReport.reportEligibility(), withLatestReport.analysisVersion(),
                withLatestReport.axes(), withLatestReport.points(), withLatestReport.report(),
                new TasteAnalysisResponse.Generation(
                        "IN_PROGRESS", false, withLatestReport.generation().dailyLimitUsedToday(),
                        false, null, pending.getLeaseExpiresAt()));
        return new AnalysisSnapshot(inProgress, likedMusicIds);
    }

    /**
     * 가장 최근 완료 시도를 붙인다. 성공이면 AI 리포트, 그보다 나중에 실패했으면 그때 저장한 대체 리포트를
     * {@code aiGenerated=false} 로 내린다 — 생성 응답과 새로고침 뒤 조회가 같아야 한다 (S15P21A405-647).
     *
     * <p>대체 문장이 없는 실패 행(이 변경 전 행, lease 만료)은 이전 성공 리포트를 그대로 두고
     * {@code failureCode} 만 싣는다.
     */
    private TasteAnalysisResponse attachLatestReport(
            String email, TasteAnalysisResponse current, List<Long> likedMusicIds) {
        TasteAnalysisRow latest = analysisMapper.findLatestSuccess(email);
        TasteAnalysisRow failed = analysisMapper.findLatestFailed(email);
        boolean failedLast = failed != null
                && (latest == null || failed.getCompletedAt().isAfter(latest.getCompletedAt()));
        String currentHash = hasher.hash(likedMusicIds, current.analysisVersion());
        if (failedLast && failed.getSummary() != null) {
            boolean fresh = currentHash.equals(failed.getLikedSetHash());
            TasteAnalysisResponse.Report report = new TasteAnalysisResponse.Report(
                    failed.getReportLevel(), false, fresh, failed.getSummary(),
                    readNarratives(failed.getNarratives()),
                    readFindings(failed.getFindings()),
                    failed.getRequestedAt(), failed.getCompletedAt(),
                    latest == null ? null : latest.getCompletedAt());
            return new TasteAnalysisResponse(
                    fresh ? "FRESH" : "STALE",
                    current.counts(), current.reportEligibility(), current.analysisVersion(),
                    current.axes(), current.points(), report,
                    new TasteAnalysisResponse.Generation(
                            "FALLBACK", false, false, true, failed.getFailureCode(), null));
        }
        String failureCode = failedLast ? failed.getFailureCode() : null;
        if (latest == null) {
            if (failureCode == null) {
                return current;
            }
            return new TasteAnalysisResponse(
                    current.state(), current.counts(), current.reportEligibility(), current.analysisVersion(),
                    current.axes(), current.points(), null,
                    new TasteAnalysisResponse.Generation(
                            current.generation().status(), false, false, true, failureCode, null));
        }
        boolean fresh = currentHash.equals(latest.getLikedSetHash());
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), zoneId);
        boolean usedToday = latest.getAnalysisDate().equals(now.toLocalDate());
        TasteAnalysisResponse.Report report = new TasteAnalysisResponse.Report(
                latest.getReportLevel(), true, fresh, latest.getSummary(),
                readNarratives(latest.getNarratives()),
                readFindings(latest.getFindings()),
                latest.getRequestedAt(), latest.getCompletedAt(), latest.getCompletedAt());
        TasteAnalysisResponse.Generation generation = new TasteAnalysisResponse.Generation(
                current.generation().status(), false, usedToday, failureCode != null, failureCode,
                usedToday ? now.toLocalDate().plusDays(1).atStartOfDay(zoneId).toOffsetDateTime() : null);
        return new TasteAnalysisResponse(
                fresh ? "FRESH" : "STALE",
                current.counts(), current.reportEligibility(), current.analysisVersion(),
                current.axes(), current.points(), report, generation);
    }

    public record AnalysisSnapshot(TasteAnalysisResponse response, List<Long> likedMusicIds) {
        public AnalysisSnapshot {
            likedMusicIds = List.copyOf(likedMusicIds);
        }
    }

    /**
     * 저장된 findings 를 그대로 되돌린다. 생성 직후 응답과 이후 조회 응답이 같아야 한다.
     * 값이 없는 행이 있어도 리포트 전체를 죽이지 않고 빈 목록으로 둔다.
     */
    private List<TasteFinding> readFindings(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("stored taste findings are invalid", error);
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
