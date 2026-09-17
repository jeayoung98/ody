package com.ssafy.backend.report.mapper;

import com.ssafy.backend.report.dto.MusicReportRow;

public interface MusicReportMapper {

    /** INSERT ... RETURNING report_id. */
    long insert(MusicReportRow row);
}