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
                        new TasteReference.Label("VERIFIED", "MEDIUM", "low", "high", "test")))
                .toList();
        return new TasteReference("taste-reference-v1", "taste-v1", 101,
                OffsetDateTime.parse("2026-09-21T00:00:00Z"),
                new TasteReference.Lineage("manifest", "a".repeat(64), "abcdef0", "config"), axes);
    }
}
