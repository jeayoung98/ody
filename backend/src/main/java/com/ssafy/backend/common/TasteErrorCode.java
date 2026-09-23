package com.ssafy.backend.common;

import org.springframework.http.HttpStatus;

import lombok.Getter;

@Getter
public enum TasteErrorCode implements ErrorCode {

    TASTE_INSUFFICIENT_SAMPLE(HttpStatus.UNPROCESSABLE_CONTENT,
            "TASTE_INSUFFICIENT_SAMPLE", "취향 리포트에는 유효한 좋아요 곡이 10개 이상 필요합니다."),
    TASTE_DAILY_LIMIT(HttpStatus.TOO_MANY_REQUESTS,
            "TASTE_DAILY_LIMIT", "오늘 생성 가능한 취향 리포트를 이미 만들었습니다."),
    TASTE_ANALYSIS_IN_PROGRESS(HttpStatus.CONFLICT,
            "TASTE_ANALYSIS_IN_PROGRESS", "취향 리포트를 생성하고 있습니다."),
    TASTE_REFERENCE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE,
            "TASTE_REFERENCE_UNAVAILABLE", "취향 분석 기준을 준비하고 있습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;

    TasteErrorCode(HttpStatus httpStatus, String code, String message) {
        this.httpStatus = httpStatus;
        this.code = code;
        this.message = message;
    }
}
