package com.ssafy.backend.taste;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.taste.analysis.TasteStatisticsCalculator;
import com.ssafy.backend.taste.analysis.TasteSnapshotHasher;
import com.ssafy.backend.taste.dto.TasteAnalysisResponse;
import com.ssafy.backend.taste.mapper.TasteAnalysisMapper;
import com.ssafy.backend.taste.mapper.TasteAnalysisRow;
import com.ssafy.backend.taste.music.TasteMusicMapper;
import com.ssafy.backend.taste.music.TasteMusicRow;
import com.ssafy.backend.taste.reference.TasteReference;
import com.ssafy.backend.taste.reference.TasteReferenceProvider;
import com.ssafy.backend.taste.service.TasteAnalysisQueryService;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.TasteErrorCode;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

class TasteAnalysisQueryServiceTests {

    private final TasteMusicMapper mapper = mock(TasteMusicMapper.class);
    private final TasteReferenceProvider references = mock(TasteReferenceProvider.class);
    private final TasteAnalysisMapper analysisMapper = mock(TasteAnalysisMapper.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final TasteAnalysisQueryService service =
            new TasteAnalysisQueryService(
                    mapper, references, new TasteStatisticsCalculator(), analysisMapper,
                    new TasteSnapshotHasher(),
                    Clock.fixed(Instant.parse("2026-09-21T00:00:00Z"), ZoneOffset.UTC), "Asia/Seoul",
                    meterRegistry);

    @Test
    void unavailableReference_isIsolatedAndCounted() {
        when(references.current()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get("me@example.com"))
                .isInstanceOf(CustomException.class)
                .satisfies(error -> assertThat(((CustomException) error).getErrorCode())
                        .isEqualTo(TasteErrorCode.TASTE_REFERENCE_UNAVAILABLE));
        assertThat(meterRegistry.counter(
                "ody.taste.query.outcomes", "outcome", "reference_unavailable").count())
                .isEqualTo(1);
    }

    @Test
    void nineTracks_returnsDistributionOnly() {
        when(references.current()).thenReturn(Optional.of(reference()));
        when(mapper.findLikedMusic("me@example.com"))
                .thenReturn(IntStream.range(0, 9).mapToObj(this::row).toList());

        TasteAnalysisResponse response = service.get("me@example.com");

        assertThat(response.state()).isEqualTo("DISTRIBUTION_ONLY");
        assertThat(response.counts().valid()).isEqualTo(9);
        assertThat(response.reportEligibility().additionalLikesNeeded()).isEqualTo(1);
        assertThat(response.axes()).hasSize(16);
    }

    @Test
    void tenTracks_returnsInitialEligibility() {
        when(references.current()).thenReturn(Optional.of(reference()));
        when(mapper.findLikedMusic("me@example.com"))
                .thenReturn(IntStream.range(0, 10).mapToObj(this::row).toList());

        TasteAnalysisResponse response = service.get("me@example.com");

        assertThat(response.state()).isEqualTo("READY");
        assertThat(response.reportEligibility().level()).isEqualTo("INITIAL");
    }

    @Test
    void twentyNineTracks_remainsInitialEligibility() {
        when(references.current()).thenReturn(Optional.of(reference()));
        when(mapper.findLikedMusic("me@example.com"))
                .thenReturn(IntStream.range(0, 29).mapToObj(this::row).toList());

        TasteAnalysisResponse response = service.get("me@example.com");

        assertThat(response.reportEligibility().level()).isEqualTo("INITIAL");
    }

    @Test
    void thirtyTracks_returnsStandardEligibility() {
        when(references.current()).thenReturn(Optional.of(reference()));
        when(mapper.findLikedMusic("me@example.com"))
                .thenReturn(IntStream.range(0, 30).mapToObj(this::row).toList());

        TasteAnalysisResponse response = service.get("me@example.com");

        assertThat(response.state()).isEqualTo("READY");
        assertThat(response.reportEligibility().level()).isEqualTo("STANDARD");
    }

    @Test
    void activeLease_returnsInProgressAndRetryTime() {
        when(references.current()).thenReturn(Optional.of(reference()));
        when(mapper.findLikedMusic("me@example.com"))
                .thenReturn(IntStream.range(0, 10).mapToObj(this::row).toList());
        TasteAnalysisRow pending = new TasteAnalysisRow();
        pending.setLeaseExpiresAt(OffsetDateTime.parse("2026-09-21T09:01:00+09:00"));
        when(analysisMapper.findActivePending(
                "me@example.com", OffsetDateTime.parse("2026-09-21T09:00:00+09:00")))
                .thenReturn(pending);

        TasteAnalysisResponse response = service.get("me@example.com");

        assertThat(response.state()).isEqualTo("IN_PROGRESS");
        assertThat(response.generation().status()).isEqualTo("IN_PROGRESS");
        assertThat(response.generation().nextAvailableAt()).isEqualTo(pending.getLeaseExpiresAt());
    }

    @Test
    void freshnessHash_includesLikedMusicWithoutValidCoordinates() {
        TasteReference reference = reference();
        List<TasteMusicRow> rows = new java.util.ArrayList<>(
                IntStream.range(0, 10).mapToObj(this::row).toList());
        TasteMusicRow invalid = new TasteMusicRow();
        invalid.setMusicId(99L);
        invalid.setTitle("invalid");
        invalid.setArtist("artist");
        rows.add(invalid);
        when(references.current()).thenReturn(Optional.of(reference));
        when(mapper.findLikedMusic("me@example.com")).thenReturn(rows);
        String hash = new TasteSnapshotHasher().hash(
                rows.stream().map(TasteMusicRow::getMusicId).toList(),
                reference.analysisVersion());
        TasteAnalysisRow latest = new TasteAnalysisRow();
        latest.setAnalysisDate(java.time.LocalDate.of(2026, 9, 21));
        latest.setLikedSetHash(hash);
        latest.setReportLevel("INITIAL");
        latest.setSummary("저장된 요약");
        latest.setNarratives("[]");
        latest.setRequestedAt(OffsetDateTime.parse("2026-09-21T08:00:00+09:00"));
        latest.setCompletedAt(OffsetDateTime.parse("2026-09-21T08:00:05+09:00"));
        when(analysisMapper.findLatestSuccess("me@example.com")).thenReturn(latest);

        TasteAnalysisResponse response = service.get("me@example.com");

        assertThat(response.state()).isEqualTo("FRESH");
        assertThat(response.counts().totalLiked()).isEqualTo(11);
        assertThat(response.counts().excluded()).isEqualTo(1);
    }

    /** 화면이 태그를 그리려면 저장된 findings 가 조회 응답에도 그대로 나와야 한다 [S15P21A405-634]. */
    @Test
    void storedFindings_areReturnedOnQuery() {
        List<TasteMusicRow> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            rows.add(row(i));
        }
        when(references.current()).thenReturn(Optional.of(reference()));
        when(mapper.findLikedMusic("me@example.com")).thenReturn(rows);
        TasteAnalysisRow latest = new TasteAnalysisRow();
        latest.setAnalysisDate(java.time.LocalDate.of(2026, 9, 21));
        latest.setLikedSetHash("다른-해시");
        latest.setReportLevel("INITIAL");
        latest.setSummary("저장된 요약");
        latest.setNarratives("[]");
        latest.setFindings("[{\"id\":\"pc3-consistent_bias\",\"type\":\"CONSISTENT_BIAS\",\"pc\":3,"
                + "\"direction\":\"HIGH\",\"effectSize\":22.4,\"evidence\":\"근거\",\"axisPhrase\":\"여백 있는\"}]");
        latest.setRequestedAt(OffsetDateTime.parse("2026-09-21T08:00:00+09:00"));
        latest.setCompletedAt(OffsetDateTime.parse("2026-09-21T08:00:05+09:00"));
        when(analysisMapper.findLatestSuccess("me@example.com")).thenReturn(latest);

        TasteAnalysisResponse response = service.get("me@example.com");

        assertThat(response.report().findings()).singleElement().satisfies(finding -> {
            assertThat(finding.id()).isEqualTo("pc3-consistent_bias");
            assertThat(finding.type()).isEqualTo("CONSISTENT_BIAS");
            assertThat(finding.pc()).isEqualTo(3);
            assertThat(finding.direction()).isEqualTo("HIGH");
            assertThat(finding.axisPhrase()).isEqualTo("여백 있는");
        });
    }

    /** findings 가 비어 있는 행이 있어도 리포트 전체가 죽지 않는다. */
    @Test
    void missingStoredFindings_doNotBreakTheReport() {
        List<TasteMusicRow> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            rows.add(row(i));
        }
        when(references.current()).thenReturn(Optional.of(reference()));
        when(mapper.findLikedMusic("me@example.com")).thenReturn(rows);
        TasteAnalysisRow latest = new TasteAnalysisRow();
        latest.setAnalysisDate(java.time.LocalDate.of(2026, 9, 21));
        latest.setLikedSetHash("다른-해시");
        latest.setReportLevel("INITIAL");
        latest.setSummary("저장된 요약");
        latest.setNarratives("[]");
        latest.setRequestedAt(OffsetDateTime.parse("2026-09-21T08:00:00+09:00"));
        latest.setCompletedAt(OffsetDateTime.parse("2026-09-21T08:00:05+09:00"));
        when(analysisMapper.findLatestSuccess("me@example.com")).thenReturn(latest);

        assertThat(service.get("me@example.com").report().findings()).isEmpty();
    }

    /** 새로고침해도 대체 리포트였다는 사실과 이유가 남아야 한다 (S15P21A405-647, A-81). */
    @Test
    void failureAfterSuccess_returnsStoredFallbackWithReason() {
        stubTenLikes();
        TasteAnalysisRow success = storedRow("SUCCESS", "AI 요약", "2026-09-20T08:00:05+09:00");
        TasteAnalysisRow failed = storedRow("FAILED", "대체 요약", "2026-09-21T08:00:05+09:00");
        failed.setFailureCode("GMS_OUTPUT_REJECTED");
        when(analysisMapper.findLatestSuccess("me@example.com")).thenReturn(success);
        when(analysisMapper.findLatestFailed("me@example.com")).thenReturn(failed);

        TasteAnalysisResponse response = service.get("me@example.com");

        assertThat(response.report().aiGenerated()).isFalse();
        assertThat(response.report().summary()).isEqualTo("대체 요약");
        assertThat(response.report().lastRefreshedAt()).isEqualTo(success.getCompletedAt());
        assertThat(response.generation().status()).isEqualTo("FALLBACK");
        assertThat(response.generation().failureCode()).isEqualTo("GMS_OUTPUT_REJECTED");
        assertThat(response.generation().canRetry()).isTrue();
    }

    @Test
    void successAfterFailure_returnsAiReport() {
        stubTenLikes();
        TasteAnalysisRow failed = storedRow("FAILED", "대체 요약", "2026-09-20T08:00:05+09:00");
        failed.setFailureCode("GMS_REQUEST_FAILED");
        when(analysisMapper.findLatestSuccess("me@example.com"))
                .thenReturn(storedRow("SUCCESS", "AI 요약", "2026-09-21T08:00:05+09:00"));
        when(analysisMapper.findLatestFailed("me@example.com")).thenReturn(failed);

        TasteAnalysisResponse response = service.get("me@example.com");

        assertThat(response.report().aiGenerated()).isTrue();
        assertThat(response.report().summary()).isEqualTo("AI 요약");
        assertThat(response.generation().failureCode()).isNull();
    }

    /** 대체 문장을 저장하기 전의 실패 행·lease 만료 행. 리포트는 없어도 이유는 내린다. */
    @Test
    void failureWithoutStoredFallback_stillReportsReason() {
        stubTenLikes();
        TasteAnalysisRow failed = new TasteAnalysisRow();
        failed.setStatus("FAILED");
        failed.setFailureCode("LEASE_EXPIRED");
        failed.setCompletedAt(OffsetDateTime.parse("2026-09-21T08:00:05+09:00"));
        when(analysisMapper.findLatestFailed("me@example.com")).thenReturn(failed);

        TasteAnalysisResponse response = service.get("me@example.com");

        assertThat(response.report()).isNull();
        assertThat(response.generation().failureCode()).isEqualTo("LEASE_EXPIRED");
        assertThat(response.generation().canRetry()).isTrue();
    }

    private void stubTenLikes() {
        List<TasteMusicRow> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            rows.add(row(i));
        }
        when(references.current()).thenReturn(Optional.of(reference()));
        when(mapper.findLikedMusic("me@example.com")).thenReturn(rows);
    }

    private static TasteAnalysisRow storedRow(String status, String summary, String completedAt) {
        TasteAnalysisRow row = new TasteAnalysisRow();
        row.setStatus(status);
        row.setAnalysisDate(java.time.LocalDate.of(2026, 9, 21));
        row.setLikedSetHash("다른-해시");
        row.setReportLevel("INITIAL");
        row.setSummary(summary);
        row.setNarratives("[]");
        row.setRequestedAt(OffsetDateTime.parse(completedAt).minusSeconds(5));
        row.setCompletedAt(OffsetDateTime.parse(completedAt));
        return row;
    }

    private TasteMusicRow row(int id) {
        TasteMusicRow row = new TasteMusicRow();
        row.setMusicId(id + 1L);
        row.setTitle("title-" + id);
        row.setArtist("artist");
        double value = id;
        row.setPc1(value); row.setPc2(value); row.setPc3(value); row.setPc4(value);
        row.setPc5(value); row.setPc6(value); row.setPc7(value); row.setPc8(value);
        row.setPc9(value); row.setPc10(value); row.setPc11(value); row.setPc12(value);
        row.setPc13(value); row.setPc14(value); row.setPc15(value); row.setPc16(value);
        return row;
    }

    private static TasteReference reference() {
        List<TasteReference.Axis> axes = IntStream.rangeClosed(1, 16)
                .mapToObj(pc -> new TasteReference.Axis(pc, 0.01,
                        IntStream.rangeClosed(0, 100).mapToObj(i -> (double) i).toList(),
                        new TasteReference.Label("VERIFIED", "MEDIUM", "axis", "low", "high", "test")))
                .toList();
        return new TasteReference("taste-reference-v1", "taste-v1", 101,
                OffsetDateTime.parse("2026-09-21T00:00:00Z"),
                new TasteReference.Lineage("manifest", "a".repeat(64), "abcdef0", "config"), axes);
    }
}
