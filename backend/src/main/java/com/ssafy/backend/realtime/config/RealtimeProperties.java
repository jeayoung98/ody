package com.ssafy.backend.realtime.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 실시간 설정 상수 타입 홀더 (application-realtime.yml 구조 대응).
 *
 * RealtimeConfig 가 @EnableConfigurationProperties 로 등록(realtime 프로파일에서만). MusicPositionCalculator 가
 * axisRange·viewport 를 주입받아 좌표 계산에 쓴다.
 *
 * 계약: specs/004-realtime-presence-nearby/plan.md §설정, data-model.md §1.
 */
@ConfigurationProperties("realtime")
public record RealtimeProperties(
		Presence presence,
		Nearby nearby,
		ViewportSettings viewport,
		List<AxisRange> axisRange) {

	public record Presence(long heartbeatIntervalMs, long ttlMs, long sweepIntervalMs, long recountIntervalMs) {
	}

	public record Nearby(int neighborK) {
	}

	/** ★ gridSize 와 clusterThresholdCells 는 세트로만 변경한다. */
	public record ViewportSettings(int gridSize, int clusterThresholdCells, int markerCap,
			long debounceMs, long cellCountsIntervalMs) {
	}

	/** 축별 전역 정규화 min/max — 실측값(music.location p01/p99, application-realtime.yml). */
	public record AxisRange(int axis, double min, double max) {
	}
}
