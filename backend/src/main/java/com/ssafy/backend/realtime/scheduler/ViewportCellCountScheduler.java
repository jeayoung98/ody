package com.ssafy.backend.realtime.scheduler;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.ssafy.backend.realtime.dto.viewport.ViewportCellCounts;
import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.dto.viewport.ViewportSnapshot;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ViewportMeta;
import com.ssafy.backend.realtime.service.viewport.ViewportService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** 셀별 인원수 화면을 최신 상태로 갱신한다. */
@Slf4j
@Component
@Profile("realtime")
@RequiredArgsConstructor
public class ViewportCellCountScheduler {

	private final MusicPositionCalculator musicPositionCalculator; // 전체 레이어 수 확인
	private final ViewportRedisRepository viewportRepository; // 갱신 대상과 화면 정보 조회
	private final ViewportService viewportService; // 최신 셀별 사용자 수 계산
	private final RealtimeMessageService realtimeMessageService; // 개인 큐 발송

	/** 5초마다 셀별 인원수 화면을 다시 보낸다. */
	@Scheduled(fixedDelayString = "${realtime.viewport.cell-counts-interval-ms:5000}")
	public void sendLatestCellCounts() {
		try {
			Map<Integer, Set<String>> usersByLayer = viewportRepository
					.findCellCountUsersByLayer(musicPositionCalculator.maxLayer());
			Set<String> emails = new LinkedHashSet<>();
			usersByLayer.values().forEach(emails::addAll);
			Map<String, ViewportMeta> metaByEmail = viewportRepository.findMetaByEmails(emails);

			for (Map.Entry<Integer, Set<String>> entry : usersByLayer.entrySet()) {
				int layer = entry.getKey();
				for (String email : entry.getValue().stream().sorted().toList()) {
					ViewportMeta meta = metaByEmail.get(email);
					if (!isCurrentCellCountScreen(meta, layer)) {
						continue;
					}
					send(email, meta);
				}
			}
		} catch (Exception e) {
			log.warn("셀별 인원수 갱신 실패", e);
		}
	}

	/** 저장된 화면이 현재 레이어의 셀별 인원수 화면인지 확인한다. */
	private static boolean isCurrentCellCountScreen(ViewportMeta meta, int layer) {
		return meta != null
				&& meta.mode() == ViewportMode.CLUSTERED
				&& meta.viewport().layer() == layer;
	}

	/** 한 사용자에게 최신 셀별 인원수를 보낸다. */
	private void send(String email, ViewportMeta meta) {
		try {
			ViewportSnapshot snapshot = viewportService.createCellCountSnapshot(
					email, meta.requestSeq(), meta.viewport());
			ViewportCellCounts payload = new ViewportCellCounts(
					snapshot.requestSeq(), snapshot.layer(), snapshot.resolution(),
					snapshot.cells().stream().filter(cell -> cell.count() > 0).toList());
			realtimeMessageService.sendToUser(
					email,
					WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.VIEWPORT_CELL_COUNTS,
					payload);
		} catch (Exception e) {
			log.warn("한 사용자의 셀별 인원수 갱신 실패", e);
		}
	}
}
