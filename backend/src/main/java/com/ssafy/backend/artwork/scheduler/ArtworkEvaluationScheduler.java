package com.ssafy.backend.artwork.scheduler;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.artwork.dto.ArtworkRow;
import com.ssafy.backend.artwork.mapper.ArtworkMapper;
import com.ssafy.backend.artwork.service.ArtworkEvaluationService;

import lombok.extern.slf4j.Slf4j;

/**
 * 대기 중인 작품을 집어 채점한다 (S15P21A405-563).
 *
 * <p><b>왜 {@code @Async} 가 아니라 스케줄러인가.</b> {@code @Async} 는 코드가 더 짧지만 서버가
 * 재시작하면 진행 중이던 {@code PENDING} 이 영영 멈춘다. 스케줄러는 같은 코드로 최초 평가·재시도·
 * 재시작 복구를 모두 덮는다.
 *
 * <p>{@code @EnableScheduling} 은 {@code RealtimeTaskConfig} 에 이미 켜져 있다.
 *
 * <p>ponytail: 배치 전체를 한 트랜잭션으로 묶는다 — {@code FOR UPDATE SKIP LOCKED} 의 락이
 * 트랜잭션 끝까지 유지돼야 다른 인스턴스가 같은 작품을 집어가지 않기 때문이다. 그래서 HTTP 왕복
 * 동안 커넥션 하나를 쥔다(최악 = batch-size × read timeout). batch-size 를 작게 두어 상한을
 * 묶었고, 처리량이 문제가 되면 {@code EVALUATING} 상태를 두어 락 없이 선점하는 쪽으로 바꾼다.
 */
@Slf4j
@Component
public class ArtworkEvaluationScheduler {

	private final ArtworkMapper artworkMapper;
	private final ArtworkEvaluationService evaluationService;
	private final int batchSize;

	public ArtworkEvaluationScheduler(
			ArtworkMapper artworkMapper,
			ArtworkEvaluationService evaluationService,
			@Value("${ody.artwork.evaluation.batch-size:3}") int batchSize) {
		this.artworkMapper = artworkMapper;
		this.evaluationService = evaluationService;
		this.batchSize = batchSize;
	}

	@Transactional
	@Scheduled(fixedDelayString = "${ody.artwork.evaluation.interval-ms:5000}")
	public void evaluatePending() {
		List<ArtworkRow> pending = artworkMapper.lockPendingForEvaluation(batchSize);
		if (pending.isEmpty()) {
			return;
		}
		log.info("[Artwork] 평가 대상 {}건", pending.size());
		for (ArtworkRow artwork : pending) {
			evaluationService.evaluate(artwork);
		}
	}
}
