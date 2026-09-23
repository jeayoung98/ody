package com.ssafy.backend.common;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

public record ErrorResponse(
        String code,
        String message,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, Object> details) {

    public ErrorResponse(String code, String message) {
        this(code, message, Map.of());
    }
}
