package com.ssafy.backend.realtime.observability;

import java.util.concurrent.TimeUnit;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;

/** 뷰포트 처리 횟수와 크기와 시간을 기록한다. */
@Component
@Profile("realtime")
@RequiredArgsConstructor
public class ViewportMetrics {

	static final String SNAPSHOT_TOTAL = "ody.realtime.viewport.snapshot.total";
	static final String SNAPSHOT_TIME = "ody.realtime.viewport.snapshot.time";
	static final String SNAPSHOT_CELLS = "ody.realtime.viewport.snapshot.cells";
	static final String SNAPSHOT_CANDIDATES = "ody.realtime.viewport.snapshot.candidates";
	static final String SNAPSHOT_USERS = "ody.realtime.viewport.snapshot.users";
	static final String DELTA_TIME = "ody.realtime.viewport.delta.time";
	static final String DELTA_CANDIDATES = "ody.realtime.viewport.delta.candidates";
	static final String DELTA_RECEIVERS = "ody.realtime.viewport.delta.receivers";
	static final String DELTA_SENT = "ody.realtime.viewport.delta.sent";
	static final String CELL_COUNTS_TIME = "ody.realtime.viewport.cell_counts.time";
	static final String CELL_COUNTS_TARGETS = "ody.realtime.viewport.cell_counts.targets";
	static final String CELL_COUNTS_SENT = "ody.realtime.viewport.cell_counts.sent";
	static final String CLOSE_TOTAL = "ody.realtime.viewport.close.total";

	private final MeterRegistry meterRegistry; // 수집한 값을 보관하고 내보내는 곳

	/**
	 * 화면 목록을 만든 결과를 기록한다.
	 *
	 * @param status 처리 결과
	 * @param mode 화면 표시 방식
	 * @param cellCount 확인한 셀 수
	 * @param candidateCount 확인한 곡 수
	 * @param userCount 확인한 사용자 수
	 * @param elapsedNanos 걸린 시간
	 */
	public void recordSnapshot(
			String status, String mode, int cellCount,
			int candidateCount, int userCount, long elapsedNanos) {
		meterRegistry.counter(SNAPSHOT_TOTAL, "status", status, "mode", mode).increment();
		meterRegistry.timer(SNAPSHOT_TIME, "status", status, "mode", mode)
				.record(elapsedNanos, TimeUnit.NANOSECONDS);
		meterRegistry.summary(SNAPSHOT_CELLS).record(cellCount);
		meterRegistry.summary(SNAPSHOT_CANDIDATES).record(candidateCount);
		meterRegistry.summary(SNAPSHOT_USERS).record(userCount);
	}

	/**
	 * 위치 변경 알림을 보낸 결과를 기록한다.
	 *
	 * @param candidateCount 처음 찾은 수신자 수
	 * @param receiverCount 실제 화면을 확인한 수신자 수
	 * @param sentCount 보낸 메시지 수
	 * @param elapsedNanos 걸린 시간
	 */
	public void recordDelta(
			int candidateCount, int receiverCount, int sentCount, long elapsedNanos) {
		meterRegistry.timer(DELTA_TIME).record(elapsedNanos, TimeUnit.NANOSECONDS);
		meterRegistry.summary(DELTA_CANDIDATES).record(candidateCount);
		meterRegistry.summary(DELTA_RECEIVERS).record(receiverCount);
		meterRegistry.summary(DELTA_SENT).record(sentCount);
	}

	/**
	 * 셀별 인원수 갱신 결과를 기록한다.
	 *
	 * @param targetCount 갱신 후보 수
	 * @param sentCount 메시지를 보낸 수
	 * @param elapsedNanos 걸린 시간
	 */
	public void recordCellCounts(int targetCount, int sentCount, long elapsedNanos) {
		meterRegistry.timer(CELL_COUNTS_TIME).record(elapsedNanos, TimeUnit.NANOSECONDS);
		meterRegistry.summary(CELL_COUNTS_TARGETS).record(targetCount);
		meterRegistry.summary(CELL_COUNTS_SENT).record(sentCount);
	}

	/**
	 * 화면 구독 닫기 결과를 기록한다.
	 *
	 * @param result 닫기 결과
	 */
	public void recordClose(String result) {
		meterRegistry.counter(CLOSE_TOTAL, "result", result).increment();
	}
}
