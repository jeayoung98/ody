package com.ssafy.backend.report.dto;

import lombok.Getter;
import lombok.Setter;

/** music_report 한 행 (MyBatis 파라미터). 컬럼명은 db/music_report.sql 과 1:1. */
@Getter
@Setter
public class MusicReportRow {

    private long musicId;
    private String userEmail;
    private String reason;
    private String detailReason;
}