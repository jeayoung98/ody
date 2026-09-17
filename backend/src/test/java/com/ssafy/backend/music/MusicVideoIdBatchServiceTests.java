package com.ssafy.backend.music;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.VideoIdBatchResponse;
import com.ssafy.backend.music.service.MusicService;
import com.ssafy.backend.music.service.NearbyService;
import com.ssafy.backend.music.videoid.VideoIdEnricher;

/** videoId 일괄 조회(MusicService.getVideoIds) 유닛 (S15P21A405-407). duration 전달을 검증한다. */
class MusicVideoIdBatchServiceTests {

    private static final Location LOC =
            new Location(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    private static MusicDetail detail(long id, String artist, String title, Integer duration, String videoId) {
        return new MusicDetail(id, "mbid", title, artist, 120.0, duration, "album",
                List.of("K-Pop"), "https://youtu.be/x", videoId, LOC, 0, 0);
    }

    private static MusicService serviceWith(MusicDetailReader reader, VideoIdEnricher enricher) {
        return new MusicService(Optional.empty(), Optional.ofNullable(reader), Optional.empty(),
                mock(NearbyService.class), enricher);
    }

    @Test
    void getVideoIds_passesDetailDurationToEnricher_forEachMusic() {
        MusicDetailReader reader = mock(MusicDetailReader.class);
        VideoIdEnricher enricher = mock(VideoIdEnricher.class);
        when(reader.findDetailsByIds(List.of(1L, 2L))).thenReturn(List.of(
                detail(1L, "IU", "Love wins all", 275, null),
                detail(2L, "BTS", "Dynamite", 199, "existingVid1")));
        when(enricher.resolve(1L, "IU", "Love wins all", null, 275)).thenReturn("resolvedVid1");
        when(enricher.resolve(2L, "BTS", "Dynamite", "existingVid1", 199)).thenReturn("existingVid1");

        VideoIdBatchResponse res = serviceWith(reader, enricher).getVideoIds(List.of(1L, 2L));

        assertThat(res.items()).hasSize(2);
        assertThat(res.items().get(0).musicId()).isEqualTo(1L);
        assertThat(res.items().get(0).videoId()).isEqualTo("resolvedVid1");
        assertThat(res.items().get(1).videoId()).isEqualTo("existingVid1");
        verify(enricher).resolve(1L, "IU", "Love wins all", null, 275);
        verify(enricher).resolve(2L, "BTS", "Dynamite", "existingVid1", 199);
    }

    @Test
    void getVideoIds_missingMusic_excludedFromResult() {
        MusicDetailReader reader = mock(MusicDetailReader.class);
        VideoIdEnricher enricher = mock(VideoIdEnricher.class);
        when(reader.findDetailsByIds(List.of(1L, 999L))).thenReturn(List.of(detail(1L, "IU", "t", 200, "v")));
        when(enricher.resolve(1L, "IU", "t", "v", 200)).thenReturn("v");

        assertThat(serviceWith(reader, enricher).getVideoIds(List.of(1L, 999L)).items()).hasSize(1);
    }

    @Test
    void getVideoIds_noReader_throwsUnsupported() {
        assertThatThrownBy(() -> serviceWith(null, mock(VideoIdEnricher.class)).getVideoIds(List.of(1L)))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
