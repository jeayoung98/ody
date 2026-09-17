package com.ssafy.backend.realtime.config;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class RealtimePropertiesTests {

	@Test
	void acceptsValidViewportSettings() {
		assertDoesNotThrow(() -> settings(16, 36, 20, 64, 250, 5_000));
	}

	@Test
	void rejectsInvalidViewportSettings() {
		assertAll(
				() -> assertThrows(IllegalArgumentException.class,
						() -> settings(10, 36, 20, 64, 250, 5_000)),
				() -> assertThrows(IllegalArgumentException.class,
						() -> settings(16, 257, 20, 64, 250, 5_000)),
				() -> assertThrows(IllegalArgumentException.class,
						() -> settings(16, 36, 0, 64, 250, 5_000)),
				() -> assertThrows(IllegalArgumentException.class,
						() -> settings(16, 36, 20, 0, 250, 5_000)),
				() -> assertThrows(IllegalArgumentException.class,
						() -> settings(16, 36, 20, 64, 0, 5_000)),
				() -> assertThrows(IllegalArgumentException.class,
						() -> settings(16, 36, 20, 64, 250, 0)));
	}

	/** 테스트할 화면 설정을 만든다. */
	private static RealtimeProperties.ViewportSettings settings(
			int gridSize,
			int clusterThresholdCells,
			int individualUserCap,
			int markerCap,
			long debounceMs,
			long cellCountsIntervalMs) {
		return new RealtimeProperties.ViewportSettings(
				gridSize,
				clusterThresholdCells,
				individualUserCap,
				markerCap,
				debounceMs,
				cellCountsIntervalMs);
	}
}
