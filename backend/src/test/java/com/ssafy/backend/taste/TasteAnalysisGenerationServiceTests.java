package com.ssafy.backend.taste;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.TasteErrorCode;
import com.ssafy.backend.taste.analysis.TasteAxisStatistics;
import com.ssafy.backend.taste.analysis.TasteFallbackRenderer;
import com.ssafy.backend.taste.analysis.TasteFindingSelector;
import com.ssafy.backend.taste.analysis.TasteSnapshotHasher;
import com.ssafy.backend.taste.dto.TasteAnalysisResponse;
import com.ssafy.backend.taste.gms.GmsTasteClient;
import com.ssafy.backend.taste.gms.GmsTasteOutput;
import com.ssafy.backend.taste.gms.GmsTasteOutputValidator;
import com.ssafy.backend.taste.mapper.TasteAnalysisMapper;
import com.ssafy.backend.taste.mapper.TasteAnalysisRow;
import com.ssafy.backend.taste.reference.TasteReference;
import com.ssafy.backend.taste.service.TasteAnalysisGenerationService;
import com.ssafy.backend.taste.service.TasteAnalysisQueryService;
import com.ssafy.backend.taste.service.TasteAnalysisQueryService.AnalysisSnapshot;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

class TasteAnalysisGenerationServiceTests {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-09-21T14:59:59Z"), ZoneOffset.UTC);

    private final TasteAnalysisQueryService queryService = mock(TasteAnalysisQueryService.class);
    private final TasteAnalysisMapper mapper = mock(TasteAnalysisMapper.class);
    private final GmsTasteClient gmsClient = mock(GmsTasteClient.class);
    private final TasteSnapshotHasher hasher = new TasteSnapshotHasher();
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private TasteAnalysisGenerationService service;

    @BeforeEach
    void setUp() {
        service = new TasteAnalysisGenerationService(
                queryService, mapper, new TasteFindingSelector(), new TasteFallbackRenderer(),
                hasher, gmsClient, new GmsTasteOutputValidator(), CLOCK,
                "Asia/Seoul", meterRegistry);
        when(queryService.snapshot("me@example.com")).thenReturn(snapshot(current()));
        when(gmsClient.model()).thenReturn("gpt-4.1");
    }

    @Test
    void validOutput_isSavedAndConsumesDailyLimit() {
        when(mapper.claim(eq("me@example.com"), any(LocalDate.class), any(), any())).thenReturn(1);
        when(gmsClient.generate(eq("INITIAL"), anyList())).thenReturn(new GmsTasteOutput(
                "resp_1", "강렬한 음악을 즐겨요.",
                List.of(new GmsTasteOutput.Narrative("pc1-consistent_bias", "강렬한 쪽에 모여 있어요."))));
        when(mapper.markSuccess(
                eq("me@example.com"), any(), any(), any(), any(), any(Integer.class), any(Integer.class),
                any(Integer.class), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), eq("resp_1"))).thenReturn(1);

        TasteAnalysisResponse response = service.generate("me@example.com");

        assertThat(response.generation().status()).isEqualTo("GENERATED");
        assertThat(response.generation().dailyLimitUsedToday()).isTrue();
        assertThat(response.report().summary()).contains("잠정 경향");
    }

    @Test
    void fewerThanTenTracks_isRejectedBeforeClaim() {
        TasteAnalysisResponse eligible = current();
        TasteAnalysisResponse insufficient = new TasteAnalysisResponse(
                "DISTRIBUTION_ONLY",
                new TasteAnalysisResponse.Counts(9, 9, 0, Map.of()),
                new TasteAnalysisResponse.Eligibility(false, null, 1),
                eligible.reference(), eligible.axes(), eligible.points().subList(0, 9),
                null, new TasteAnalysisResponse.Generation(
                        "INELIGIBLE", false, false, false, null, null));
        when(queryService.snapshot("me@example.com")).thenReturn(snapshot(insufficient));

        assertThatThrownBy(() -> service.generate("me@example.com"))
                .isInstanceOf(CustomException.class)
                .satisfies(error -> assertThat(((CustomException) error).getErrorCode())
                        .isEqualTo(TasteErrorCode.TASTE_INSUFFICIENT_SAMPLE));
    }

    @Test
    void gmsFailure_returnsFallbackAndAllowsRetry() {
        when(mapper.claim(eq("me@example.com"), any(LocalDate.class), any(), any())).thenReturn(1);
        when(mapper.markFailed(
                eq("me@example.com"), any(), any(), any(), eq("GMS_REQUEST_FAILED"))).thenReturn(1);
        when(gmsClient.generate(eq("INITIAL"), anyList()))
                .thenThrow(new GmsTasteClient.GmsTasteException("GMS_REQUEST_FAILED"));

        TasteAnalysisResponse response = service.generate("me@example.com");

        assertThat(response.state()).isEqualTo("FALLBACK");
        assertThat(response.generation().canRetry()).isTrue();
        assertThat(response.generation().dailyLimitUsedToday()).isFalse();
        assertThat(meterRegistry.counter(
                "ody.taste.gms.failures", "code", "GMS_REQUEST_FAILED").count()).isEqualTo(1);
        verify(mapper).markFailed(
                eq("me@example.com"), any(), any(), any(), eq("GMS_REQUEST_FAILED"));
    }

    @Test
    void sameSnapshot_reusesStoredReportWithoutCallingGms() {
        TasteAnalysisResponse current = current();
        String hash = hasher.hash(
                current.points().stream().map(TasteAnalysisResponse.Point::musicId).toList(),
                current.reference(), "taste-prompt-v1");
        TasteAnalysisRow latest = successfulRow(hash);
        when(mapper.findLatestSuccess("me@example.com")).thenReturn(latest);

        TasteAnalysisResponse response = service.generate("me@example.com");

        assertThat(response.generation().status()).isEqualTo("REUSED");
        assertThat(response.report().lastRefreshedAt()).isEqualTo(latest.getCompletedAt());
    }

    @Test
    void changedSnapshotAfterTodaySuccess_returnsDailyLimitWithNextMidnight() {
        TasteAnalysisRow today = successfulRow("different");
        when(mapper.findByDate("me@example.com", LocalDate.of(2026, 9, 21))).thenReturn(today);

        assertThatThrownBy(() -> service.generate("me@example.com"))
                .isInstanceOf(CustomException.class)
                .satisfies(error -> {
                    CustomException custom = (CustomException) error;
                    assertThat(custom.getErrorCode()).isEqualTo(TasteErrorCode.TASTE_DAILY_LIMIT);
                    assertThat(custom.getDetails().get("nextAvailableAt"))
                            .isEqualTo("2026-09-22T00:00+09:00");
                });
    }

    @Test
    void activeClaim_returnsConflictWithLeaseExpiry() {
        TasteAnalysisRow pending = new TasteAnalysisRow();
        pending.setStatus("PENDING");
        pending.setLeaseExpiresAt(OffsetDateTime.parse("2026-09-22T00:00:59+09:00"));
        when(mapper.findActivePending("me@example.com", OffsetDateTime.parse("2026-09-21T23:59:59+09:00")))
                .thenReturn(pending);

        assertThatThrownBy(() -> service.generate("me@example.com"))
                .isInstanceOf(CustomException.class)
                .satisfies(error -> {
                    CustomException custom = (CustomException) error;
                    assertThat(custom.getErrorCode()).isEqualTo(TasteErrorCode.TASTE_ANALYSIS_IN_PROGRESS);
                    assertThat(custom.getDetails().get("nextAvailableAt"))
                            .isEqualTo("2026-09-22T00:00:59+09:00");
                });
    }

    private static TasteAnalysisResponse current() {
        TasteReference.Label label =
                new TasteReference.Label("VERIFIED", "STRONG", "잔잔한", "강렬한", "test");
        TasteAxisStatistics axis = new TasteAxisStatistics(
                1,
                new TasteAxisStatistics.Summary(0, 1, 2, 3, 4),
                new TasteAxisStatistics.PercentileSummary(50, 70, 80, 90, 100, 20),
                List.of(0, 0, 0, 0, 0, 0, 0, 1, 8, 1), 0.1, label);
        List<TasteAnalysisResponse.Point> points = IntStream.range(0, 10)
                .mapToObj(id -> new TasteAnalysisResponse.Point(
                        id + 1L, "title", "artist", java.util.Collections.nCopies(16, 1.0)))
                .toList();
        return new TasteAnalysisResponse(
                "READY",
                new TasteAnalysisResponse.Counts(10, 10, 0, Map.of()),
                new TasteAnalysisResponse.Eligibility(true, "INITIAL", 0),
                new TasteAnalysisResponse.ReferenceVersions("bundle", "reference", "labels", "taste-v1"),
                List.of(axis), points, null,
                new TasteAnalysisResponse.Generation("NOT_REQUESTED", false, false, false, null, null));
    }

    private static TasteAnalysisRow successfulRow(String hash) {
        TasteAnalysisRow row = new TasteAnalysisRow();
        row.setAnalysisDate(LocalDate.of(2026, 9, 21));
        row.setStatus("SUCCESS");
        row.setLikedSetHash(hash);
        row.setReportLevel("INITIAL");
        row.setSummary("저장된 요약");
        row.setNarratives("[]");
        row.setRequestedAt(OffsetDateTime.parse("2026-09-21T12:00:00+09:00"));
        row.setCompletedAt(OffsetDateTime.parse("2026-09-21T12:00:05+09:00"));
        return row;
    }

    private static AnalysisSnapshot snapshot(TasteAnalysisResponse response) {
        return new AnalysisSnapshot(
                response,
                response.points().stream().map(TasteAnalysisResponse.Point::musicId).toList());
    }
}
