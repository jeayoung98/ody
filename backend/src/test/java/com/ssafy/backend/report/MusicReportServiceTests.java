package com.ssafy.backend.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.report.dto.MusicReportRequest;
import com.ssafy.backend.report.dto.MusicReportRow;
import com.ssafy.backend.report.mapper.MusicReportMapper;
import com.ssafy.backend.report.service.MusicReportService;

/** 음원 신고 서비스 유닛 (S15P21A405-388). 저장·비로그인·없는 곡 404·B-D 대기 동작 검증. */
class MusicReportServiceTests {

    private static final Location LOC =
            new Location(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    private static MusicDetail detail(long id) {
        return new MusicDetail(id, "mbid", "title", "artist", 120.0, 200, "album", 2007,
                "https://youtu.be/x", null, LOC, 0, 0);
    }

    private static MusicReportService serviceWith(MusicReportMapper mapper, MusicDetailReader reader) {
        return new MusicReportService(mapper, Optional.ofNullable(reader));
    }

    private static MusicReportRequest request(long musicId, String reason, String detailReason) {
        return new MusicReportRequest(musicId, reason, detailReason);
    }

    @Test
    void report_loggedIn_savesRowWithEmailAndReturnsId() {
        MusicReportMapper mapper = mock(MusicReportMapper.class);
        MusicDetailReader reader = mock(MusicDetailReader.class);
        when(reader.findDetail(10234L)).thenReturn(Optional.of(detail(10234L)));
        when(mapper.insert(org.mockito.ArgumentMatchers.any())).thenReturn(7L);

        long reportId = serviceWith(mapper, reader)
                .report(request(10234L, "noise", "재생이 안 됨"), "me@gmail.com").reportId();

        ArgumentCaptor<MusicReportRow> captor = ArgumentCaptor.forClass(MusicReportRow.class);
        verify(mapper).insert(captor.capture());
        MusicReportRow row = captor.getValue();
        assertThat(reportId).isEqualTo(7L);
        assertThat(row.getMusicId()).isEqualTo(10234L);
        assertThat(row.getUserEmail()).isEqualTo("me@gmail.com");
        assertThat(row.getReason()).isEqualTo("noise");
        assertThat(row.getDetailReason()).isEqualTo("재생이 안 됨");
    }

    @Test
    void report_anonymous_savesNullEmail() {
        MusicReportMapper mapper = mock(MusicReportMapper.class);
        MusicDetailReader reader = mock(MusicDetailReader.class);
        when(reader.findDetail(10234L)).thenReturn(Optional.of(detail(10234L)));
        when(mapper.insert(org.mockito.ArgumentMatchers.any())).thenReturn(8L);

        long reportId = serviceWith(mapper, reader)
                .report(request(10234L, "spoken", null), null).reportId();

        ArgumentCaptor<MusicReportRow> captor = ArgumentCaptor.forClass(MusicReportRow.class);
        verify(mapper).insert(captor.capture());
        assertThat(reportId).isEqualTo(8L);
        assertThat(captor.getValue().getUserEmail()).isNull();
    }

    @Test
    void report_missingMusic_throwsMusicNotFound() {
        MusicReportMapper mapper = mock(MusicReportMapper.class);
        MusicDetailReader reader = mock(MusicDetailReader.class);
        when(reader.findDetail(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> serviceWith(mapper, reader).report(request(999L, "other", null), null))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(MusicErrorCode.MUSIC_NOT_FOUND);

        verify(mapper, org.mockito.Mockito.never()).insert(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void report_noReader_throwsUnsupported() {
        MusicReportMapper mapper = mock(MusicReportMapper.class);

        assertThatThrownBy(() -> serviceWith(mapper, null).report(request(10234L, "other", null), null))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
