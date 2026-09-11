package com.ssafy.backend.realtime.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 실시간 설정 상수 타입 홀더 (application-realtime.yml 구조 대응).
 *
 * 골격 단계: 클래스만 정의하고 빈으로 등록하지 않는다. 서비스는 당장 @Value(":기본값") 로 읽어
 * realtime 프로파일·yml 없이도 컨텍스트가 뜨게 한다. 내부작업 때
 * @EnableConfigurationProperties(RealtimeProperties.class) 등록 + 주입으로 전환한다.
 *
 * 계약: specs/004-realtime-presence-nearby/plan.md §설정, data-model.md §1.
 */
@ConfigurationProperties("realtime")
public record RealtimeProperties(
		Presence presence,
		Nearby nearby,
		Viewport viewport,
		List<LayerAxis> layers,
		List<AxisRange> axisRange) {

	public record Presence(long heartbeatIntervalMs, long ttlMs, long sweepIntervalMs, long recountIntervalMs) {
	}

	public record Nearby(int neighborK) {
	}

	/** ★ gridSize 와 clusterThresholdCells 는 세트로만 변경한다. */
	public record Viewport(int gridSize, int clusterThresholdCells, int markerCap,
			long debounceMs, long cellCountsIntervalMs) {
	}

	/** 레이어 l → 표시 축 PC(2l-1), PC(2l). */
	public record LayerAxis(int layer, int axisX, int axisY) {
	}

	/** 축별 전역 min/max — ★ 실측 전 임의값(B-4). */
	public record AxisRange(int axis, double min, double max) {
	}
}
