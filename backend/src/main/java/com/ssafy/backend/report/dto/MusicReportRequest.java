package com.ssafy.backend.report.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * POST /api/music/report 요청. 비로그인 허용 — user_email 은 서버가 인증 정보로 채운다.
 *
 * @param musicId      신고 대상 곡
 * @param reason       {@code spoken} 음성만 있음 · {@code noise} 잡음·재생 불가 · {@code other} 기타
 * @param detailReason 자유 서술. 선택
 */
public record MusicReportRequest(
        @NotNull @Min(1) Long musicId,
        @NotNull @Pattern(regexp = "spoken|noise|other") String reason,
        @Size(max = 2000) String detailReason) {
}