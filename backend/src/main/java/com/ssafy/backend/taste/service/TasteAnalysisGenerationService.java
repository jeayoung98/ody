package com.ssafy.backend.taste.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.TasteErrorCode;
import com.ssafy.backend.taste.analysis.TasteFallbackRenderer;
import com.ssafy.backend.taste.analysis.TasteFinding;
import com.ssafy.backend.taste.analysis.TasteFindingSelector;
import com.ssafy.backend.taste.analysis.TasteSnapshotHasher;
import com.ssafy.backend.taste.dto.TasteAnalysisResponse;
import com.ssafy.backend.taste.gms.GmsTasteClient;
import com.ssafy.backend.taste.gms.GmsTasteOutput;
import com.ssafy.backend.taste.gms.GmsTasteOutputValidator;
import com.ssafy.backend.taste.mapper.TasteAnalysisMapper;
import com.ssafy.backend.taste.mapper.TasteAnalysisRow;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

@Service
public class TasteAnalysisGenerationService {

    private static final Duration LEASE_DURATION = Duration.ofSeconds(60);

    private final TasteAnalysisQueryService queryService;
    private final TasteAnalysisMapper mapper;
    private final TasteFindingSelector findingSelector;
    private final TasteFallbackRenderer fallbackRenderer;
    private final TasteSnapshotHasher hasher;
    private final GmsTasteClient gmsClient;
    private final GmsTasteOutputValidator outputValidator;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final ZoneId zoneId;
    private final MeterRegistry meterRegistry;

    public TasteAnalysisGenerationService(
            TasteAnalysisQueryService queryService,
            TasteAnalysisMapper mapper,
            TasteFindingSelector findingSelector,
            TasteFallbackRenderer fallbackRenderer,
            TasteSnapshotHasher hasher,
            GmsTasteClient gmsClient,
            GmsTasteOutputValidator outputValidator,
            Clock clock,
            @Value("${ody.taste.zone}") String zone,
            MeterRegistry meterRegistry) {
        this.queryService = queryService;
        this.mapper = mapper;
        this.findingSelector = findingSelector;
        this.fallbackRenderer = fallbackRenderer;
        this.hasher = hasher;
        this.gmsClient = gmsClient;
        this.outputValidator = outputValidator;
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.clock = clock;
        this.zoneId = ZoneId.of(zone);
        this.meterRegistry = meterRegistry;
    }

    public TasteAnalysisResponse generate(String email) {
        meterRegistry.counter("ody.taste.generation.requests").increment();
        TasteAnalysisQueryService.AnalysisSnapshot requestedSnapshot = queryService.snapshot(email);
        TasteAnalysisResponse current = requestedSnapshot.response();
        if (!current.reportEligibility().eligible()) {
            meterRegistry.counter("ody.taste.generation.outcomes", "outcome", "insufficient").increment();
            throw new CustomException(TasteErrorCode.TASTE_INSUFFICIENT_SAMPLE);
        }

        String hash = hasher.hash(requestedSnapshot.likedMusicIds(), current.analysisVersion());
        TasteAnalysisRow latest = mapper.findLatestSuccess(email);
        if (latest != null && hash.equals(latest.getLikedSetHash())) {
            meterRegistry.counter("ody.taste.generation.outcomes", "outcome", "reused").increment();
            return withStoredReport(current, latest, "FRESH", "REUSED", false);
        }

        OffsetDateTime requestedAt = OffsetDateTime.ofInstant(clock.instant(), zoneId);
        LocalDate analysisDate = requestedAt.toLocalDate();
        TasteAnalysisRow today = mapper.findByDate(email, analysisDate);
        if (today != null && "SUCCESS".equals(today.getStatus())) {
            throw dailyLimit(requestedAt);
        }
        claim(email, analysisDate, requestedAt);

        List<TasteFinding> findings = findingSelector.select(current.axes(), current.counts().valid());
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            GmsTasteOutput generated = gmsClient.generate(current.reportEligibility().level(), findings);
            outputValidator.validate(generated, findings);
            sample.stop(meterRegistry.timer("ody.taste.gms.latency", "outcome", "success"));
            OffsetDateTime completedAt = OffsetDateTime.ofInstant(clock.instant(), zoneId);
            String summary = ensureInitialLanguage(current.reportEligibility().level(), generated.summary());
            List<TasteAnalysisResponse.Narrative> narratives = toNarratives(generated, findings);
            int updated = mapper.markSuccess(
                    email, analysisDate, requestedAt, completedAt, hash,
                    current.counts().valid(),
                    current.reportEligibility().level(),
                    current.analysisVersion(), gmsClient.model(),
                    json(current.axes()), json(findings), summary, json(narratives), generated.responseId());
            if (updated != 1) {
                throw new IllegalStateException("taste analysis success transition failed");
            }
            meterRegistry.counter("ody.taste.generation.outcomes", "outcome", "generated").increment();
            boolean fresh = isCurrentSnapshot(email, hash);
            TasteAnalysisResponse.Report report = new TasteAnalysisResponse.Report(
                    current.reportEligibility().level(), true, fresh, summary, narratives,
                    requestedAt, completedAt, completedAt);
            return withReport(current, fresh ? "FRESH" : "STALE", report,
                    new TasteAnalysisResponse.Generation("GENERATED", true, true, false, null,
                            nextMidnight(requestedAt)));
        } catch (GmsTasteClient.GmsTasteException | IllegalArgumentException error) {
            sample.stop(meterRegistry.timer("ody.taste.gms.latency", "outcome", "fallback"));
            String failureCode = error instanceof GmsTasteClient.GmsTasteException gms
                    ? gms.code() : "GMS_OUTPUT_REJECTED";
            meterRegistry.counter("ody.taste.gms.failures", "code", failureCode).increment();
            OffsetDateTime completedAt = OffsetDateTime.ofInstant(clock.instant(), zoneId);
            if (mapper.markFailed(email, analysisDate, requestedAt, completedAt, failureCode) != 1) {
                throw new IllegalStateException("taste analysis failure transition failed");
            }
            meterRegistry.counter("ody.taste.generation.outcomes", "outcome", "fallback").increment();
            TasteFallbackRenderer.RenderedReport fallback =
                    fallbackRenderer.render(current.reportEligibility().level(), findings);
            TasteAnalysisResponse.Report report = new TasteAnalysisResponse.Report(
                    current.reportEligibility().level(), false, true,
                    fallback.summary(), fallback.narratives(), requestedAt, completedAt,
                    latest == null ? null : latest.getCompletedAt());
            return withReport(current, "FALLBACK", report,
                    new TasteAnalysisResponse.Generation(
                            "FALLBACK", false, false, true, failureCode, null));
        }
    }

    private boolean isCurrentSnapshot(String email, String requestedHash) {
        TasteAnalysisQueryService.AnalysisSnapshot current = queryService.snapshot(email);
        String currentHash = hasher.hash(
                current.likedMusicIds(), current.response().analysisVersion());
        return requestedHash.equals(currentHash);
    }

    private void claim(String email, LocalDate date, OffsetDateTime requestedAt) {
        mapper.expireStalePending(email, requestedAt);
        try {
            if (mapper.claim(email, date, requestedAt, requestedAt.plus(LEASE_DURATION)) == 1) {
                return;
            }
        } catch (DataIntegrityViolationException error) {
            throw inProgress(email, requestedAt);
        }
        TasteAnalysisRow row = mapper.findByDate(email, date);
        if (row != null && "SUCCESS".equals(row.getStatus())) {
            throw dailyLimit(requestedAt);
        }
        throw inProgress(email, requestedAt);
    }

    private CustomException inProgress(String email, OffsetDateTime now) {
        meterRegistry.counter("ody.taste.generation.outcomes", "outcome", "in_progress").increment();
        TasteAnalysisRow pending = mapper.findActivePending(email, now);
        if (pending == null || pending.getLeaseExpiresAt() == null) {
            return new CustomException(TasteErrorCode.TASTE_ANALYSIS_IN_PROGRESS);
        }
        return new CustomException(
                TasteErrorCode.TASTE_ANALYSIS_IN_PROGRESS,
                Map.of("nextAvailableAt", pending.getLeaseExpiresAt().toString()));
    }

    private CustomException dailyLimit(OffsetDateTime now) {
        OffsetDateTime next = nextMidnight(now);
        meterRegistry.counter("ody.taste.generation.outcomes", "outcome", "daily_limit").increment();
        return new CustomException(
                TasteErrorCode.TASTE_DAILY_LIMIT, Map.of("nextAvailableAt", next.toString()));
    }

    private OffsetDateTime nextMidnight(OffsetDateTime now) {
        return now.toLocalDate().plusDays(1).atStartOfDay(zoneId).toOffsetDateTime();
    }

    private TasteAnalysisResponse withStoredReport(
            TasteAnalysisResponse current,
            TasteAnalysisRow row,
            String state,
            String generationStatus,
            boolean generatedThisRequest) {
        TasteAnalysisResponse.Report report = new TasteAnalysisResponse.Report(
                row.getReportLevel(), true, true, row.getSummary(), readNarratives(row.getNarratives()),
                row.getRequestedAt(), row.getCompletedAt(), row.getCompletedAt());
        boolean usedToday = row.getAnalysisDate().equals(OffsetDateTime.ofInstant(clock.instant(), zoneId).toLocalDate());
        return withReport(current, state, report,
                new TasteAnalysisResponse.Generation(
                        generationStatus, generatedThisRequest, usedToday, false, null,
                        usedToday ? nextMidnight(OffsetDateTime.ofInstant(clock.instant(), zoneId)) : null));
    }

    private static TasteAnalysisResponse withReport(
            TasteAnalysisResponse current,
            String state,
            TasteAnalysisResponse.Report report,
            TasteAnalysisResponse.Generation generation) {
        return new TasteAnalysisResponse(
                state, current.counts(), current.reportEligibility(), current.analysisVersion(),
                current.axes(), current.points(), report, generation);
    }

    private static List<TasteAnalysisResponse.Narrative> toNarratives(
            GmsTasteOutput output, List<TasteFinding> findings) {
        Map<String, TasteFinding> byId = findings.stream()
                .collect(Collectors.toMap(TasteFinding::id, Function.identity()));
        return output.narratives().stream()
                .map(narrative -> new TasteAnalysisResponse.Narrative(
                        narrative.findingId(), narrative.text(), byId.get(narrative.findingId()).evidence()))
                .toList();
    }

    private static String ensureInitialLanguage(String level, String summary) {
        if ("INITIAL".equals(level) && !summary.contains("잠정")) {
            return "현재 좋아요에서 보이는 잠정 경향으로, " + summary;
        }
        return summary;
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("taste snapshot serialization failed", error);
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
