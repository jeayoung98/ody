package com.ssafy.backend.realtime.presence.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/**
 * C→S /app/presence/viewport — 화면 범위(원시 pc)와 누적 bounds. layer 변경 = 레이어 이동(FR-054).
 * 계약: contracts/realtime-websocket.md §1.1, FR-050.
 */
public record ViewportRequest(
		@NotNull Integer layer,
		@NotNull Double minX, @NotNull Double maxX,
		@NotNull Double minY, @NotNull Double maxY,
		@NotEmpty List<Bound> bounds) {

	public record Bound(@NotNull Integer axis, @NotNull Double min, @NotNull Double max) {
	}
}
