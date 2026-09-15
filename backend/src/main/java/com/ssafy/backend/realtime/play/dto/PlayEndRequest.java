package com.ssafy.backend.realtime.play.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/** PATCH /music/play/end 요청. played_ms 갱신(멱등). 위치는 변하지 않는다. */
public record PlayEndRequest(
		@NotNull Long playHistoryId,
		@NotNull @PositiveOrZero Long playedMs) {
}
