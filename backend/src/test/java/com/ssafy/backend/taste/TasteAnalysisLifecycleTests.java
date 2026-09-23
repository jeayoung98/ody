package com.ssafy.backend.taste;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
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

class TasteAnalysisLifecycleTests {

    private static final String EMAIL = "me@example.com";
    private static final Clock BEFORE_MIDNIGHT =
            Clock.fixed(Instant.parse("2026-09-21T14:59:59Z"), ZoneOffset.UTC);

    private final TasteAnalysisQueryService queryService = mock(TasteAnalysisQueryService.class);
    private final TasteAnalysisMapper mapper = mock(TasteAnalysisMapper.class);
    private final GmsTasteClient gmsClient = mock(GmsTasteClient.class);

    @Test
    void likesChangedDuringGeneration_returnsSavedSnapshotAsStale() {
        AnalysisSnapshot requested = snapshot(10);
        AnalysisSnapshot changed = snapshot(11);
        when(queryService.snapshot(EMAIL)).thenReturn(requested, changed);
        when(mapper.claim(eq(EMAIL), any(), any(), any())).thenReturn(1);
        when(gmsClient.model()).thenReturn("gpt-4o");
        when(gmsClient.generate(eq("INITIAL"), anyList(), anyInt())).thenReturn(output());
        stubSuccessfulTransition();

        TasteAnalysisResponse response = service(BEFORE_MIDNIGHT).generate(EMAIL);

        assertThat(response.state()).isEqualTo("STALE");
        assertThat(response.report().fresh()).isFalse();
        assertThat(response.points()).hasSize(10);
    }

    @Test
    void activeClaim_returnsConflictAndLeaseExpiry() {
        when(queryService.snapshot(EMAIL)).thenReturn(snapshot(10));
        TasteAnalysisRow pending = new TasteAnalysisRow();
        pending.setLeaseExpiresAt(OffsetDateTime.parse("2026-09-22T00:00:59+09:00"));
        when(mapper.findActivePending(EMAIL, OffsetDateTime.parse("2026-09-21T23:59:59+09:00")))
                .thenReturn(pending);

        assertThatThrownBy(() -> service(BEFORE_MIDNIGHT).generate(EMAIL))
                .isInstanceOf(CustomException.class)
                .satisfies(error -> {
                    CustomException custom = (CustomException) error;
                    assertThat(custom.getErrorCode()).isEqualTo(TasteErrorCode.TASTE_ANALYSIS_IN_PROGRESS);
                    assertThat(custom.getDetails().get("nextAvailableAt"))
                            .isEqualTo("2026-09-22T00:00:59+09:00");
                });
    }

    @Test
    void failedAttempt_canRetryOnTheSameDateAndKeepsLastSuccessTime() {
        when(queryService.snapshot(EMAIL)).thenReturn(snapshot(10));
        TasteAnalysisRow previous = successRow("old-hash", LocalDate.of(2026, 9, 20));
        when(mapper.findLatestSuccess(EMAIL)).thenReturn(previous);
        when(mapper.claim(eq(EMAIL), any(), any(), any())).thenReturn(1);
        when(mapper.markFailed(eq(EMAIL), any(), any(), any(), eq("GMS_REQUEST_FAILED"))).thenReturn(1);
        when(gmsClient.generate(eq("INITIAL"), anyList(), anyInt()))
                .thenThrow(new GmsTasteClient.GmsTasteException("GMS_REQUEST_FAILED"));

        TasteAnalysisResponse first = service(BEFORE_MIDNIGHT).generate(EMAIL);
        TasteAnalysisResponse second = service(BEFORE_MIDNIGHT).generate(EMAIL);

        assertThat(first.generation().canRetry()).isTrue();
        assertThat(second.generation().canRetry()).isTrue();
        assertThat(second.report().lastRefreshedAt()).isEqualTo(previous.getCompletedAt());
        verify(mapper, times(2)).claim(eq(EMAIL), any(), any(), any());
    }

    @Test
    void nextKstDate_hasANewQuota() {
        Clock midnight = Clock.fixed(Instant.parse("2026-09-21T15:00:00Z"), ZoneOffset.UTC);
        when(queryService.snapshot(EMAIL)).thenReturn(snapshot(10));
        when(mapper.claim(eq(EMAIL), eq(LocalDate.of(2026, 9, 22)), any(), any())).thenReturn(1);
        when(mapper.markFailed(
                eq(EMAIL), eq(LocalDate.of(2026, 9, 22)), any(), any(), eq("GMS_REQUEST_FAILED")))
                .thenReturn(1);
        when(gmsClient.generate(eq("INITIAL"), anyList(), anyInt()))
                .thenThrow(new GmsTasteClient.GmsTasteException("GMS_REQUEST_FAILED"));

        TasteAnalysisResponse response = service(midnight).generate(EMAIL);

        assertThat(response.generation().status()).isEqualTo("FALLBACK");
        verify(mapper).findByDate(EMAIL, LocalDate.of(2026, 9, 22));
    }

    @Test
    void sameSnapshot_reusesSuccessWithoutClaiming() {
        AnalysisSnapshot snapshot = snapshot(10);
        String hash = new TasteSnapshotHasher().hash(
                snapshot.likedMusicIds(), snapshot.response().analysisVersion());
        when(queryService.snapshot(EMAIL)).thenReturn(snapshot);
        when(mapper.findLatestSuccess(EMAIL)).thenReturn(successRow(hash, LocalDate.of(2026, 9, 21)));

        TasteAnalysisResponse response = service(BEFORE_MIDNIGHT).generate(EMAIL);

        assertThat(response.generation().status()).isEqualTo("REUSED");
        verify(mapper, times(0)).claim(anyString(), any(), any(), any());
    }

    private TasteAnalysisGenerationService service(Clock clock) {
        return new TasteAnalysisGenerationService(
                queryService, mapper, new TasteFindingSelector(), new TasteFallbackRenderer(),
                new TasteSnapshotHasher(), gmsClient, new GmsTasteOutputValidator(), clock,
                "Asia/Seoul", new SimpleMeterRegistry());
    }

    private void stubSuccessfulTransition() {
        when(mapper.markSuccess(
                eq(EMAIL), any(), any(), any(), anyString(), anyInt(),
                anyString(), anyString(), anyString(), anyString(), anyString(), anyString(),
                anyString(), anyString()))
                .thenReturn(1);
    }

    private static AnalysisSnapshot snapshot(int count) {
        TasteReference.Label label =
                new TasteReference.Label("VERIFIED", "STRONG", "세기", "잔잔한", "강렬한", "test");
        TasteAxisStatistics axis = new TasteAxisStatistics(
                1,
                new TasteAxisStatistics.Summary(0, 1, 2, 3, 4),
                // 10곡 기준 치우침 31.4 / 좁음 14.8. CONSISTENT_BIAS 로 분류되도록 중앙 85, IQR 12.
                new TasteAxisStatistics.PercentileSummary(50, 79, 85, 91, 100, 12),
                List.of(0, 0, 0, 0, 0, 0, 0, 1, 8, 1), 0.1, label);
        List<TasteAnalysisResponse.Point> points = IntStream.range(0, count)
                .mapToObj(id -> new TasteAnalysisResponse.Point(
                        id + 1L, "title", "artist", java.util.Collections.nCopies(16, 1.0)))
                .toList();
        TasteAnalysisResponse response = new TasteAnalysisResponse(
                "READY", new TasteAnalysisResponse.Counts(count, count, 0, Map.of()),
                new TasteAnalysisResponse.Eligibility(true, count < 30 ? "INITIAL" : "STANDARD", 0),
                "taste-v1",
                List.of(axis), points, null,
                new TasteAnalysisResponse.Generation("NOT_REQUESTED", false, false, false, null, null));
        return new AnalysisSnapshot(response, points.stream().map(TasteAnalysisResponse.Point::musicId).toList());
    }

    private static GmsTasteOutput output() {
        return new GmsTasteOutput(
                "resp_1", "강렬한 음악을 즐겨요.",
                List.of(new GmsTasteOutput.Narrative(
                        "pc1-consistent_bias", "강렬한 쪽에 모여 있어요.")));
    }

    private static TasteAnalysisRow successRow(String hash, LocalDate date) {
        TasteAnalysisRow row = new TasteAnalysisRow();
        row.setAnalysisDate(date);
        row.setStatus("SUCCESS");
        row.setLikedSetHash(hash);
        row.setReportLevel("INITIAL");
        row.setSummary("저장된 요약");
        row.setNarratives("[]");
        row.setRequestedAt(OffsetDateTime.parse("2026-09-20T12:00:00+09:00"));
        row.setCompletedAt(OffsetDateTime.parse("2026-09-20T12:00:05+09:00"));
        return row;
    }
}
