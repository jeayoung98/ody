package com.ssafy.backend.realtime.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/** 뷰포트 지표의 값과 안전한 태그를 검증한다. */
class ViewportMetricsTests {

	@Test
	@DisplayName("화면 조회와 델타와 주기 갱신과 닫기 결과를 기록한다")
	void recordsViewportMetrics() {
		SimpleMeterRegistry registry = new SimpleMeterRegistry();
		ViewportMetrics metrics = new ViewportMetrics(registry);

		metrics.recordSnapshot("SNAPSHOT", "INDIVIDUAL", 9, 4, 3, 1_000_000);
		metrics.recordDelta(4, 3, 2, 2_000_000);
		metrics.recordCellCounts(5, 4, 3_000_000);
		metrics.recordClose("STALE_CONNECTION");

		assertThat(registry.get(ViewportMetrics.SNAPSHOT_TOTAL)
				.tags("status", "SNAPSHOT", "mode", "INDIVIDUAL").counter().count())
				.isEqualTo(1);
		assertThat(registry.get(ViewportMetrics.SNAPSHOT_CANDIDATES).summary().totalAmount())
				.isEqualTo(4);
		assertThat(registry.get(ViewportMetrics.DELTA_SENT).summary().totalAmount())
				.isEqualTo(2);
		assertThat(registry.get(ViewportMetrics.CELL_COUNTS_TARGETS).summary().totalAmount())
				.isEqualTo(5);
		assertThat(registry.get(ViewportMetrics.CELL_COUNTS_SENT).summary().totalAmount())
				.isEqualTo(4);
		assertThat(registry.get(ViewportMetrics.CLOSE_TOTAL)
				.tag("result", "STALE_CONNECTION").counter().count())
				.isEqualTo(1);
	}

	@Test
	@DisplayName("지표 태그에는 정해진 분류값만 사용한다")
	void usesOnlySafeMetricTags() {
		SimpleMeterRegistry registry = new SimpleMeterRegistry();
		ViewportMetrics metrics = new ViewportMetrics(registry);
		metrics.recordSnapshot("STALE_CONNECTION", "NONE", 0, 0, 0, 1);
		metrics.recordDelta(0, 0, 0, 1);
		metrics.recordCellCounts(0, 0, 1);
		metrics.recordClose("OLD_REQUEST");

		Set<String> allowedTagKeys = Set.of("status", "mode", "result");
		assertThat(registry.getMeters())
				.flatExtracting(meter -> meter.getId().getTags())
				.extracting(tag -> tag.getKey())
				.allMatch(allowedTagKeys::contains);
		assertThat(registry.getMeters())
				.flatExtracting(meter -> meter.getId().getTags())
				.extracting(tag -> tag.getValue())
				.noneMatch(value -> value.contains("@") || value.contains("Bearer "));
		assertThat(registry.getMeters())
				.extracting(Meter::getId)
				.allMatch(id -> id.getTags().stream()
						.noneMatch(tag -> tag.getKey().matches("email|token|pc\\d+|x|y")));
	}
}
