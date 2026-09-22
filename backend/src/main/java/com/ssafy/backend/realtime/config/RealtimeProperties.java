package com.ssafy.backend.realtime.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 실시간 설정 상수 타입 홀더 (application-realtime.yml 구조 대응).
 *
 * RealtimeConfig 가 @EnableConfigurationProperties 로 등록(realtime 프로파일에서만).
 * MusicPositionCalculator 가 axisRange·viewport 를 주입받아 좌표 계산에 쓴다.
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

	/**
	 * 주변사람 설정.
	 *
	 * panelCap 은 패널에 올릴 최대 인원이다. 기준이 레이어 전체가 되면서 사람이 많은 층에서는
	 * 수십 명이 될 수 있는데, 그러면 레이더도 목록도 못 읽는다. 가까운 순으로 이 수까지만 자른다.
	 */
	public record Nearby(int neighborK, int panelCap) {

		public Nearby {
			if (panelCap < 1) {
				throw new IllegalArgumentException("panel-cap은 1 이상이어야 한다");
			}
		}
	}

	/** 화면 표시 방식과 갱신 주기 설정. */
	public record ViewportSettings(int gridSize, int clusterThresholdCells, int individualUserCap,
			int markerCap, long debounceMs, long cellCountsIntervalMs) {

		/** 잘못된 화면 설정이면 서버 시작을 막는다. */
		public ViewportSettings {
			if (gridSize < 4 || (gridSize & (gridSize - 1)) != 0) {
				throw new IllegalArgumentException("grid-size는 4 이상의 2의 제곱수여야 한다");
			}
			if (clusterThresholdCells < 1 || clusterThresholdCells > gridSize * gridSize) {
				throw new IllegalArgumentException("cluster-threshold-cells가 격자 범위를 벗어났다");
			}
			if (individualUserCap < 1) {
				throw new IllegalArgumentException("individual-user-cap은 1 이상이어야 한다");
			}
			if (markerCap < 1) {
				throw new IllegalArgumentException("marker-cap은 1 이상이어야 한다");
			}
			if (debounceMs < 1 || cellCountsIntervalMs < 1) {
				throw new IllegalArgumentException("화면 갱신 시간은 1ms 이상이어야 한다");
			}
		}
	}

	/** 축별 전역 정규화 min/max — 실측값(music.location p01/p99, application-realtime.yml). */
	public record AxisRange(int axis, double min, double max) {
	}
}
