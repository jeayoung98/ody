package com.ssafy.backend.report.service;

import java.util.Optional;

import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.report.dto.MusicReportRequest;
import com.ssafy.backend.report.dto.MusicReportResponse;
import com.ssafy.backend.report.dto.MusicReportRow;
import com.ssafy.backend.report.mapper.MusicReportMapper;

import lombok.extern.slf4j.Slf4j;

/** 음원 신고 저장. 존재하지 않는 곡은 404 MUSIC_NOT_FOUND. */
@Slf4j
@Service
public class MusicReportService {

    private final MusicReportMapper musicReportMapper;
    private final Optional<MusicDetailReader> musicDetailReader;

    public MusicReportService(MusicReportMapper musicReportMapper, Optional<MusicDetailReader> musicDetailReader) {
        this.musicReportMapper = musicReportMapper;
        this.musicDetailReader = musicDetailReader;
    }

    /** @param userEmail 로그인 주체. 비로그인은 null */
    public MusicReportResponse report(MusicReportRequest request, String userEmail) {
        MusicDetailReader reader = musicDetailReader.orElseThrow(
                () -> new UnsupportedOperationException("report/music: BE4 조회 어댑터 대기 중 (B-D)"));
        reader.findDetail(request.musicId())
                .orElseThrow(() -> new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));

        MusicReportRow row = new MusicReportRow();
        row.setMusicId(request.musicId());
        row.setUserEmail(userEmail);
        row.setReason(request.reason());
        row.setDetailReason(request.detailReason());

        long reportId = musicReportMapper.insert(row);
        log.info("[MusicReport] 신고 저장 완료 musicId={} reason={} reportId={}",
                request.musicId(), request.reason(), reportId);
        return new MusicReportResponse(reportId);
    }
}